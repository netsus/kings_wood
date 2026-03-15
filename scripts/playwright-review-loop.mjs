import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { chromium, devices } from 'playwright'

function parseArgs(argv) {
  const args = {
    outDir: '.artifacts/playwright-review',
    sceneSelector: '.viewer-shell',
    waitMs: 6000,
    url: '',
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

    if (token === '--wait' && rest[0]) {
      args.waitMs = Number(rest.shift())
      continue
    }
  }

  return args
}

function toConsoleRecord(msg) {
  return {
    text: msg.text(),
    type: msg.type(),
  }
}

function summarizeFindings(result) {
  const findings = []

  if (result.pageErrors.length > 0) {
    findings.push({
      severity: 'high',
      title: `${result.name}: 브라우저 런타임 에러`,
      detail: result.pageErrors[0],
    })
  }

  if (result.requestFailures.length > 0) {
    findings.push({
      severity: 'high',
      title: `${result.name}: 네트워크 실패 요청`,
      detail: result.requestFailures[0],
    })
  }

  if (result.metrics.hasHorizontalOverflow) {
    findings.push({
      severity: 'medium',
      title: `${result.name}: 가로 오버플로우 감지`,
      detail: `scrollWidth=${result.metrics.scrollWidth}, viewportWidth=${result.metrics.viewport.width}`,
    })
  }

  if (result.metrics.brokenImageCount > 0) {
    findings.push({
      severity: 'high',
      title: `${result.name}: 깨진 이미지 감지`,
      detail: `brokenImageCount=${result.metrics.brokenImageCount}`,
    })
  }

  if (!result.metrics.sceneSelectorFound) {
    findings.push({
      severity: 'medium',
      title: `${result.name}: 주요 장면 셀렉터 누락`,
      detail: `selector=${result.sceneSelector}`,
    })
  }

  if (result.metrics.statusText?.includes('장면 초기화 오류')) {
    findings.push({
      severity: 'high',
      title: `${result.name}: 3D 장면 초기화 실패`,
      detail: result.metrics.statusText,
    })
  }

  if (result.metrics.statusText?.includes('Fallback')) {
    findings.push({
      severity: 'medium',
      title: `${result.name}: fallback 모드로 실행됨`,
      detail: result.metrics.statusText,
    })
  }

  if (result.metrics.viewerErrorText) {
    findings.push({
      severity: 'high',
      title: `${result.name}: 뷰어 렌더링 에러 패널 표시`,
      detail: result.metrics.viewerErrorText,
    })
  }

  if (result.screenshotErrors.length > 0) {
    findings.push({
      severity: 'medium',
      title: `${result.name}: 스크린샷 캡처 폴백 발생`,
      detail: result.screenshotErrors[0],
    })
  }

  return findings
}

async function reviewViewport(browser, profile, config) {
  const context = await browser.newContext(profile.contextOptions)
  const page = await context.newPage()
  const consoleMessages = []
  const pageErrors = []
  const requestFailures = []

  page.on('console', (msg) => {
    consoleMessages.push(toConsoleRecord(msg))
  })
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })
  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`)
  })

  await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(config.waitMs)

  const sceneLocator = page.locator(config.sceneSelector).first()
  const sceneExists = (await sceneLocator.count()) > 0

  const fullScreenshotPath = resolve(config.outDir, `${profile.name}-full.png`)
  const screenshotErrors = []

  try {
    await page.screenshot({ fullPage: true, path: fullScreenshotPath })
  } catch (error) {
    screenshotErrors.push(`fullPage screenshot failed: ${error instanceof Error ? error.message : String(error)}`)
    try {
      await page.screenshot({ path: fullScreenshotPath })
    } catch (fallbackError) {
      screenshotErrors.push(`viewport screenshot failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`)
    }
  }

  let sceneScreenshotPath = null
  if (sceneExists) {
    sceneScreenshotPath = resolve(config.outDir, `${profile.name}-scene.png`)
    try {
      await sceneLocator.screenshot({ path: sceneScreenshotPath })
    } catch (error) {
      screenshotErrors.push(`scene screenshot failed: ${error instanceof Error ? error.message : String(error)}`)
      sceneScreenshotPath = null
    }
  }

  const metrics = await page.evaluate((sceneSelector) => {
    const doc = document.documentElement
    const statusText = document.querySelector('.status-pill')?.textContent?.trim() ?? null
    const brokenImageCount = [...document.images].filter((img) => img.complete && img.naturalWidth === 0).length
    const bodyText = document.body?.innerText ?? ''
    const viewerErrorText = bodyText.includes('An error occurred while rendering')
      ? bodyText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .find((line) => line.includes('An error occurred while rendering') || line.includes('Fragment shader failed to compile')) ?? 'An error occurred while rendering.'
      : null

    return {
      brokenImageCount,
      hasHorizontalOverflow: doc.scrollWidth > window.innerWidth + 1,
      sceneSelectorFound: Boolean(document.querySelector(sceneSelector)),
      scrollHeight: doc.scrollHeight,
      scrollWidth: doc.scrollWidth,
      statusText,
      title: document.title,
      viewerErrorText,
      viewport: {
        height: window.innerHeight,
        width: window.innerWidth,
      },
    }
  }, config.sceneSelector)

  await context.close()

  return {
    consoleMessages,
    fullScreenshotPath,
    metrics,
    name: profile.name,
    pageErrors,
    requestFailures,
    sceneScreenshotPath,
    sceneSelector: config.sceneSelector,
    screenshotErrors,
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
    lines.push(`- horizontal overflow: ${result.metrics.hasHorizontalOverflow}`)
    lines.push(`- broken images: ${result.metrics.brokenImageCount}`)
    lines.push(`- viewer error: ${result.metrics.viewerErrorText ?? 'none'}`)
    lines.push(`- page errors: ${result.pageErrors.length}`)
    lines.push(`- request failures: ${result.requestFailures.length}`)
    lines.push(`- full screenshot: ${result.fullScreenshotPath}`)
    lines.push(`- scene screenshot: ${result.sceneScreenshotPath ?? 'not captured'}`)
    lines.push(`- screenshot errors: ${result.screenshotErrors.length}`)
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  const config = parseArgs(process.argv.slice(2))

  if (!config.url) {
    console.error('Usage: node scripts/playwright-review-loop.mjs <url> [--out DIR] [--scene-selector SELECTOR] [--wait MS]')
    process.exit(1)
  }

  await mkdir(config.outDir, { recursive: true })

  const browser = await chromium.launch({
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
    headless: true,
  })

  const profiles = [
    {
      contextOptions: {
        ...devices['iPhone 13'],
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
      },
      name: 'mobile',
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
      name: 'desktop',
    },
  ]

  const results = []

  for (const profile of profiles) {
    results.push(await reviewViewport(browser, profile, config))
  }

  await browser.close()

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
