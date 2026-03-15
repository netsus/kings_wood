import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { chromium, devices } from 'playwright'

function parseArgs(argv) {
  const args = {
    diagnosticsSelector: '.review-diagnostics',
    outDir: '.artifacts/playwright-review',
    sceneSelector: '.viewer-shell',
    url: '',
    waitMs: 6000,
  }

  const rest = [...argv]

  while (rest.length > 0) {
    const token = rest.shift()

    if (!token) {
      continue
    }

    if (!token.startsWith('--') && !args.url) {
      args.url = token
      continue
    }

    if (token === '--out' && rest[0]) {
      args.outDir = rest.shift()
      continue
    }

    if (token === '--scene-selector' && rest[0]) {
      args.sceneSelector = rest.shift()
      continue
    }

    if (token === '--diagnostics-selector' && rest[0]) {
      args.diagnosticsSelector = rest.shift()
      continue
    }

    if (token === '--wait' && rest[0]) {
      args.waitMs = Number(rest.shift())
      continue
    }
  }

  return args
}

function redactSecrets(value) {
  return value
    .replace(/([?&]key=)[^&]+/gi, '$1REDACTED')
    .replace(/([?&]session=)[^&]+/gi, '$1REDACTED')
}

function isBenign3dAbort(url, failureText) {
  return (
    failureText === 'net::ERR_ABORTED' && url.includes('/v1/3dtiles/')
  )
}

function isBenign2dTile404(url, status) {
  return status === 404 && url.includes('/v1/2dtiles/')
}

function toConsoleRecord(msg) {
  return {
    text: redactSecrets(msg.text()),
    type: msg.type(),
  }
}

function summarizeFindings(result) {
  const findings = []

  if (result.pageErrors.length > 0) {
    findings.push({
      detail: result.pageErrors[0],
      severity: 'high',
      title: `${result.name}: 브라우저 런타임 에러`,
    })
  }

  if (result.requestFailures.length > 0) {
    findings.push({
      detail: result.requestFailures[0],
      severity: 'high',
      title: `${result.name}: 네트워크 실패 요청`,
    })
  }

  if (result.httpErrors.length > 0) {
    findings.push({
      detail: result.httpErrors[0],
      severity: result.httpErrors[0].includes('403') ? 'high' : 'medium',
      title: `${result.name}: HTTP 오류 응답`,
    })
  }

  if (result.metrics.hasHorizontalOverflow) {
    findings.push({
      detail: `scrollWidth=${result.metrics.scrollWidth}, viewportWidth=${result.metrics.viewport.width}`,
      severity: 'medium',
      title: `${result.name}: 가로 오버플로우 감지`,
    })
  }

  if (result.metrics.brokenImageCount > 0) {
    findings.push({
      detail: `brokenImageCount=${result.metrics.brokenImageCount}`,
      severity: 'high',
      title: `${result.name}: 깨진 이미지 감지`,
    })
  }

  if (!result.metrics.sceneSelectorFound) {
    findings.push({
      detail: `selector=${result.sceneSelector}`,
      severity: 'medium',
      title: `${result.name}: 주요 장면 셀렉터 누락`,
    })
  }

  if (result.metrics.mode === 'error') {
    findings.push({
      detail: result.metrics.statusText ?? 'error mode',
      severity: 'high',
      title: `${result.name}: 장면 초기화 오류`,
    })
  }

  if (result.metrics.mode === 'google-satellite-only') {
    findings.push({
      detail: result.metrics.statusText ?? 'google-satellite-only',
      severity: 'high',
      title: `${result.name}: Google 3D가 빠지고 satellite-only 상태로 실행됨`,
    })
  }

  if (!result.metrics.google3dReady && result.metrics.mode !== 'loading') {
    findings.push({
      detail:
        result.metrics.runtimeLastError ??
        result.metrics.statusText ??
        'Google 3D not ready',
      severity: 'high',
      title: `${result.name}: Google photorealistic 3D 미준비`,
    })
  }

  if (result.metrics.viewerErrorText) {
    findings.push({
      detail: result.metrics.viewerErrorText,
      severity: 'high',
      title: `${result.name}: 뷰어 렌더링 에러 패널 표시`,
    })
  }

  if (!result.metrics.overlayVisible) {
    findings.push({
      detail: 'review diagnostics reports overlayVisible=false',
      severity: 'high',
      title: `${result.name}: 오버레이 미가시성`,
    })
  }

  if (
    result.touchOrbit &&
    result.touchOrbit.supported &&
    result.touchOrbit.changed === false
  ) {
    findings.push({
      detail: `before=${JSON.stringify(result.touchOrbit.beforeCamera)}, after=${JSON.stringify(result.touchOrbit.afterCamera)}`,
      severity: 'high',
      title: `${result.name}: 모바일 터치 회전이 카메라 변화를 만들지 못함`,
    })
  }

  if (result.screenshotErrors.length > 0) {
    findings.push({
      detail: result.screenshotErrors[0],
      severity: 'medium',
      title: `${result.name}: 스크린샷 캡처 폴백 발생`,
    })
  }

  return findings
}

async function readReviewDiagnostics(page, selector) {
  return page.evaluate((diagnosticsSelector) => {
    const diagnosticsNode = document.querySelector(diagnosticsSelector)

    if (!diagnosticsNode?.textContent) {
      return null
    }

    try {
      return JSON.parse(diagnosticsNode.textContent)
    } catch {
      return null
    }
  }, selector)
}

async function waitForSettledRuntime(page, selector) {
  try {
    await page.waitForFunction(
      (diagnosticsSelector) => {
        const diagnosticsNode = document.querySelector(diagnosticsSelector)

        if (!diagnosticsNode?.textContent) {
          return false
        }

        try {
          const payload = JSON.parse(diagnosticsNode.textContent)
          return payload?.mode && payload.mode !== 'loading'
        } catch {
          return false
        }
      },
      selector,
      { timeout: 30_000 },
    )
  } catch {
    return
  }
}

async function captureMetrics(page, config) {
  return page.evaluate(
    ({ diagnosticsSelector, sceneSelector }) => {
      const doc = document.documentElement
      const statusText =
        document.querySelector('.status-pill')?.textContent?.trim() ?? null
      const brokenImageCount = [...document.images].filter(
        (img) => img.complete && img.naturalWidth === 0,
      ).length
      const bodyText = document.body?.innerText ?? ''
      const diagnosticsNode = document.querySelector(diagnosticsSelector)
      let reviewPayload = null

      if (diagnosticsNode?.textContent) {
        try {
          reviewPayload = JSON.parse(diagnosticsNode.textContent)
        } catch {
          reviewPayload = null
        }
      }

      const viewerErrorText = bodyText.includes('An error occurred while rendering')
        ? bodyText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .find(
              (line) =>
                line.includes('An error occurred while rendering') ||
                line.includes('Fragment shader failed to compile'),
            ) ?? 'An error occurred while rendering.'
        : null

      return {
        brokenImageCount,
        camera: reviewPayload?.diagnostics?.camera ?? null,
        google3dReady: Boolean(reviewPayload?.diagnostics?.google3dReady),
        googleSatelliteReady: Boolean(
          reviewPayload?.diagnostics?.googleSatelliteReady,
        ),
        hasHorizontalOverflow: doc.scrollWidth > window.innerWidth + 1,
        mode: reviewPayload?.mode ?? null,
        overlayVisible: Boolean(reviewPayload?.diagnostics?.overlayVisible),
        request403Count: Number(
          reviewPayload?.diagnostics?.request403Count ?? 0,
        ),
        runtimeLastError: reviewPayload?.diagnostics?.lastError ?? null,
        sceneSelectorFound: Boolean(document.querySelector(sceneSelector)),
        scrollHeight: doc.scrollHeight,
        scrollWidth: doc.scrollWidth,
        selectedPreset: reviewPayload?.selectedPreset ?? null,
        statusText,
        tileFailureCount: Number(
          reviewPayload?.diagnostics?.tileFailureCount ?? 0,
        ),
        title: document.title,
        viewerErrorText,
        viewport: {
          height: window.innerHeight,
          width: window.innerWidth,
        },
      }
    },
    {
      diagnosticsSelector: config.diagnosticsSelector,
      sceneSelector: config.sceneSelector,
    },
  )
}

async function runMobileTouchOrbitCheck(page, config) {
  const before = await readReviewDiagnostics(page, config.diagnosticsSelector)
  const canvasLocator = page.locator('.viewer-canvas canvas').first()

  if ((await canvasLocator.count()) === 0) {
    return {
      changed: false,
      reason: 'canvas not found',
      supported: false,
    }
  }

  const dragWorked = await page.evaluate(async (selector) => {
    const target = document.querySelector(selector)

    if (!(target instanceof HTMLElement)) {
      return false
    }

    const rect = target.getBoundingClientRect()
    const startX = rect.left + rect.width * 0.74
    const startY = rect.top + rect.height * 0.52
    const endX = rect.left + rect.width * 0.28
    const endY = rect.top + rect.height * 0.36
    const steps = 6

    const fire = (type, clientX, clientY, buttons) =>
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          buttons,
          cancelable: true,
          clientX,
          clientY,
          composed: true,
          isPrimary: true,
          pointerId: 1,
          pointerType: 'touch',
          pressure: buttons === 0 ? 0 : 0.5,
        }),
      )

    fire('pointerdown', startX, startY, 1)

    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps
      const x = startX + (endX - startX) * progress
      const y = startY + (endY - startY) * progress

      fire('pointermove', x, y, 1)
      await new Promise((resolve) => window.setTimeout(resolve, 34))
    }

    fire('pointerup', endX, endY, 0)
    return true
  }, '.viewer-canvas canvas')

  if (!dragWorked) {
    return {
      changed: false,
      reason: 'pointer events were not dispatched',
      supported: false,
    }
  }

  await page.waitForTimeout(1_000)

  const after = await readReviewDiagnostics(page, config.diagnosticsSelector)
  const beforeCamera = before?.diagnostics?.camera ?? null
  const afterCamera = after?.diagnostics?.camera ?? null

  if (!beforeCamera || !afterCamera) {
    return {
      afterCamera,
      beforeCamera,
      changed: false,
      reason: 'camera diagnostics unavailable',
      supported: true,
    }
  }

  const headingDelta = Math.abs(afterCamera.headingDeg - beforeCamera.headingDeg)
  const pitchDelta = Math.abs(afterCamera.pitchDeg - beforeCamera.pitchDeg)

  return {
    afterCamera,
    beforeCamera,
    changed: headingDelta > 1 || pitchDelta > 1,
    headingDelta,
    pitchDelta,
    supported: true,
  }
}

async function triggerScenarioAction(page, scenario) {
  if (!scenario.preset) {
    return
  }

  const presetButton = page.locator(`[data-camera-preset="${scenario.preset}"]`).first()

  if ((await presetButton.count()) === 0) {
    return
  }

  await presetButton.click()
  await page.waitForTimeout(1_100)
}

async function reviewScenario(scenario, config) {
  const browser = await chromium.launch({
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
    headless: true,
  })
  const context = await browser.newContext(scenario.contextOptions)
  const page = await context.newPage()
  const consoleMessages = []
  const pageErrors = []
  const requestFailures = []
  const httpErrors = []

  page.on('console', (msg) => {
    consoleMessages.push(toConsoleRecord(msg))
  })
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })
  page.on('requestfailed', (request) => {
    const url = request.url()
    const failureText = request.failure()?.errorText ?? 'unknown'

    if (isBenign3dAbort(url, failureText)) {
      return
    }

    requestFailures.push(
      `${request.method()} ${redactSecrets(url)} :: ${failureText}`,
    )
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      if (isBenign2dTile404(response.url(), response.status())) {
        return
      }

      httpErrors.push(
        `${response.status()} ${response.request().method()} ${redactSecrets(
          response.url(),
        )}`,
      )
    }
  })

  await page.goto(config.url, {
    timeout: 60_000,
    waitUntil: 'domcontentloaded',
  })
  await waitForSettledRuntime(page, config.diagnosticsSelector)
  await page.waitForTimeout(config.waitMs)
  await triggerScenarioAction(page, scenario)
  await page.waitForTimeout(2_000)

  const sceneLocator = page.locator(config.sceneSelector).first()
  const sceneExists = (await sceneLocator.count()) > 0
  const fullScreenshotPath = resolve(config.outDir, `${scenario.name}-full.png`)
  const screenshotErrors = []

  try {
    await page.screenshot({ fullPage: true, path: fullScreenshotPath })
  } catch (error) {
    screenshotErrors.push(
      `fullPage screenshot failed: ${error instanceof Error ? error.message : String(error)}`,
    )

    try {
      await page.screenshot({ path: fullScreenshotPath })
    } catch (fallbackError) {
      screenshotErrors.push(
        `viewport screenshot failed: ${
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        }`,
      )
    }
  }

  let sceneScreenshotPath = null
  if (sceneExists) {
    sceneScreenshotPath = resolve(config.outDir, `${scenario.name}-scene.png`)

    try {
      await sceneLocator.screenshot({ path: sceneScreenshotPath })
    } catch (error) {
      screenshotErrors.push(
        `scene screenshot failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      sceneScreenshotPath = null
    }
  }

  const metrics = await captureMetrics(page, config)
  const touchOrbit =
    scenario.name === 'mobile-default'
      ? await runMobileTouchOrbitCheck(page, config)
      : null

  await context.close()
  await browser.close()

  return {
    consoleMessages,
    fullScreenshotPath,
    httpErrors,
    metrics,
    name: scenario.name,
    pageErrors,
    requestFailures,
    sceneScreenshotPath,
    sceneSelector: config.sceneSelector,
    screenshotErrors,
    touchOrbit,
  }
}

function buildMarkdownReport(config, results, findings) {
  const lines = [
    '# Playwright UI Review Report',
    '',
    `- URL: ${config.url}`,
    `- Output: ${config.outDir}`,
    `- Wait: ${config.waitMs}ms`,
    '',
    '## Auto Findings',
    '',
  ]

  if (findings.length === 0) {
    lines.push('- No automatic issues detected. Visual review is still required.')
  } else {
    for (const finding of findings) {
      lines.push(`- [${finding.severity}] ${finding.title}: ${finding.detail}`)
    }
  }

  lines.push('', '## Viewports', '')

  for (const result of results) {
    lines.push(`### ${result.name}`)
    lines.push(`- title: ${result.metrics.title}`)
    lines.push(`- viewport: ${result.metrics.viewport.width}x${result.metrics.viewport.height}`)
    lines.push(`- scroll: ${result.metrics.scrollWidth}x${result.metrics.scrollHeight}`)
    lines.push(`- status: ${result.metrics.statusText ?? 'N/A'}`)
    lines.push(`- mode: ${result.metrics.mode ?? 'N/A'}`)
    lines.push(`- selected preset: ${result.metrics.selectedPreset ?? 'N/A'}`)
    lines.push(`- google 3d ready: ${result.metrics.google3dReady}`)
    lines.push(`- google satellite ready: ${result.metrics.googleSatelliteReady}`)
    lines.push(`- overlay visible: ${result.metrics.overlayVisible}`)
    lines.push(`- 403 count: ${result.metrics.request403Count}`)
    lines.push(`- tile failure count: ${result.metrics.tileFailureCount}`)
    lines.push(`- horizontal overflow: ${result.metrics.hasHorizontalOverflow}`)
    lines.push(`- broken images: ${result.metrics.brokenImageCount}`)
    lines.push(`- viewer error: ${result.metrics.viewerErrorText ?? 'none'}`)
    lines.push(`- page errors: ${result.pageErrors.length}`)
    lines.push(`- request failures: ${result.requestFailures.length}`)
    lines.push(`- http errors: ${result.httpErrors.length}`)
    lines.push(`- full screenshot: ${result.fullScreenshotPath}`)
    lines.push(`- scene screenshot: ${result.sceneScreenshotPath ?? 'not captured'}`)
    lines.push(`- screenshot errors: ${result.screenshotErrors.length}`)

    if (result.touchOrbit) {
      lines.push(
        `- mobile touch orbit changed: ${result.touchOrbit.changed} (supported: ${result.touchOrbit.supported})`,
      )
    }

    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  const config = parseArgs(process.argv.slice(2))

  if (!config.url) {
    console.error(
      'Usage: node scripts/playwright-review-loop.mjs <url> [--out DIR] [--scene-selector SELECTOR] [--diagnostics-selector SELECTOR] [--wait MS]',
    )
    process.exit(1)
  }

  await mkdir(config.outDir, { recursive: true })

  const mobileContextOptions = {
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    userAgent: devices['iPhone 13'].userAgent,
    viewport: {
      height: 844,
      width: 390,
    },
  }

  const scenarios = [
    {
      contextOptions: mobileContextOptions,
      name: 'mobile-default',
    },
    {
      contextOptions: mobileContextOptions,
      name: 'mobile-east',
      preset: 'east',
    },
    {
      contextOptions: mobileContextOptions,
      name: 'mobile-west',
      preset: 'west',
    },
    {
      contextOptions: mobileContextOptions,
      name: 'mobile-top',
      preset: 'top',
    },
    {
      contextOptions: {
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        viewport: {
          height: 1100,
          width: 1440,
        },
      },
      name: 'desktop-default',
    },
  ]

  const results = []

  for (const scenario of scenarios) {
    results.push(await reviewScenario(scenario, config))
  }

  const findings = results.flatMap(summarizeFindings)
  const report = {
    findings,
    generatedAt: new Date().toISOString(),
    results,
    url: config.url,
  }

  const reportJsonPath = resolve(config.outDir, 'report.json')
  const reportMdPath = resolve(config.outDir, 'report.md')

  await mkdir(dirname(reportJsonPath), { recursive: true })
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(reportMdPath, buildMarkdownReport(config, results, findings), 'utf8')

  console.log(`Saved review artifacts to ${config.outDir}`)
  console.log(`Report: ${reportMdPath}`)
}

await main()
