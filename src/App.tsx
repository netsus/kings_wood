import { startTransition, useEffect, useState } from 'react'
import phase2Plan from '../Phase2_Floor_Plan.png'
import sitePlan from '../Site_Plan.png'
import { KingsWoodScene, type SceneRuntime } from './components/KingsWoodScene'
import {
  kingsWoodSite,
  type CameraPresetName,
  type OverlayCalibration,
} from './data/site'
import {
  deriveOverlayScale,
  detectCalibrationMode,
  loadOverlayCalibrationDraft,
  metersToLatitudeDegrees,
  metersToLongitudeDegrees,
  resetOverlayCalibrationDraft,
  saveOverlayCalibrationDraft,
} from './lib/siteCalibration'
import './App.css'

const statusCopy: Record<
  SceneRuntime['mode'],
  {
    detail: string
    label: string
  }
> = {
  error: {
    detail:
      'Google Map Tiles API 키, localhost referrer 제한, 브라우저 WebGL 상태를 먼저 확인해 주세요.',
    label: '장면 초기화 오류',
  },
  'google-satellite-only': {
    detail:
      'Google satellite는 연결됐지만 photorealistic 3D가 빠진 상태입니다. 최종 완료 기준에서는 합격이 아닙니다.',
    label: 'Google Satellite Only',
  },
  'google3d-ready': {
    detail:
      'Google photorealistic 3D 위에 2차단지 평면도를 올리고, 모바일 터치 회전까지 가능한 목표 상태입니다.',
    label: 'Google Photorealistic 3D',
  },
  loading: {
    detail:
      'Google satellite 바닥지도와 photorealistic 3D, 2차단지 오버레이를 순서대로 준비하고 있습니다.',
    label: '3D 로딩 중',
  },
}

function getInitialCalibration(isCalibrationMode: boolean) {
  return isCalibrationMode
    ? loadOverlayCalibrationDraft(kingsWoodSite.overlayCalibration)
    : kingsWoodSite.overlayCalibration
}

function App() {
  const isCalibrationMode = detectCalibrationMode()
  const [showOverlay, setShowOverlay] = useState(true)
  const [overlayCalibration, setOverlayCalibration] = useState<OverlayCalibration>(
    () => getInitialCalibration(isCalibrationMode),
  )
  const [nudgeStepMeters, setNudgeStepMeters] = useState(1)
  const [sceneBootMaskActive, setSceneBootMaskActive] = useState(isCalibrationMode)
  const [viewPreset, setViewPreset] = useState<CameraPresetName>('default')
  const [viewCommandId, setViewCommandId] = useState(0)
  const [runtime, setRuntime] = useState<SceneRuntime>({
    diagnostics: {
      camera: {
        headingDeg: kingsWoodSite.cameraPresets.default.heading,
        pitchDeg: kingsWoodSite.cameraPresets.default.pitch,
        preset: 'default',
        rangeMeters: kingsWoodSite.cameraPresets.default.range,
      },
      google3dReady: false,
      googleSatelliteReady: false,
      hasApiKey: Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()),
      lastError: null,
      overlayVisible: true,
      request403Count: 0,
      tileFailureCount: 0,
    },
    message: '장면 초기화 중',
    mode: 'loading',
  })

  useEffect(() => {
    if (!isCalibrationMode) {
      return
    }

    saveOverlayCalibrationDraft(overlayCalibration)
  }, [isCalibrationMode, overlayCalibration])

  useEffect(() => {
    if (!isCalibrationMode) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSceneBootMaskActive(false)
    }, 1800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isCalibrationMode])

  const activeStatus = statusCopy[runtime.mode]
  const showSceneLoadingMask =
    runtime.mode === 'loading' || (isCalibrationMode && sceneBootMaskActive)
  const overlayScale = deriveOverlayScale(
    overlayCalibration,
    kingsWoodSite.overlayCalibration,
  )

  const reviewPayload = {
    calibration: overlayCalibration,
    diagnostics: runtime.diagnostics,
    isCalibrationMode,
    mode: runtime.mode,
    selectedPreset: viewPreset,
    showOverlay,
  }

  const updateCalibration = (
    updater:
      | OverlayCalibration
      | ((current: OverlayCalibration) => OverlayCalibration),
  ) => {
    setOverlayCalibration((current) =>
      typeof updater === 'function' ? updater(current) : updater,
    )
  }

  const nudgeCalibration = (northMeters: number, eastMeters: number) => {
    updateCalibration((current) => ({
      ...current,
      centerLat: current.centerLat + metersToLatitudeDegrees(northMeters),
      centerLon:
        current.centerLon +
        metersToLongitudeDegrees(eastMeters, current.centerLat),
    }))
  }

  const handleScaleChange = (scale: number) => {
    updateCalibration((current) => ({
      ...current,
      heightMeters: Number(
        (kingsWoodSite.overlayCalibration.heightMeters * scale).toFixed(2),
      ),
      widthMeters: Number(
        (kingsWoodSite.overlayCalibration.widthMeters * scale).toFixed(2),
      ),
    }))
  }

  const handlePresetChange = (preset: CameraPresetName) => {
    startTransition(() => {
      setViewPreset(preset)
      setViewCommandId((current) => current + 1)
    })
  }

  const handleResetCalibration = () => {
    resetOverlayCalibrationDraft()
    setOverlayCalibration(kingsWoodSite.overlayCalibration)
  }

  const handleResetView = () => {
    startTransition(() => {
      setViewPreset('default')
      setViewCommandId((current) => current + 1)
    })
  }

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="eyebrow-row">
          <span className="eyebrow">Kings Wood Google 3D</span>
          <span className="eyebrow subtle">
            {isCalibrationMode ? '캘리브레이션 모드' : '모바일 우선 프로토타입'}
          </span>
        </div>
        <h1>킹스우드 2차단지를 구글 3D 지형 위에서 맞춰 보는 현장형 웹사이트</h1>
        <p className="hero-copy">
          Google satellite를 기본 바닥지도로 쓰고, 가능하면
          <strong> photorealistic 3D</strong>까지 띄운 뒤
          <strong>
            <code>Phase2_Floor_Plan.png</code>
          </strong>
          의 2차단지 부분을 반투명 오버레이로 맞춥니다. 정합 기준은
          메인 진입 도로 축, 상단 곡선 도로, 공원 블록, 하단 생활시설 구역입니다.
        </p>

        <div className="hero-grid">
          <article className="fact-card">
            <span className="fact-label">입력 기준 주소</span>
            <strong>{kingsWoodSite.userAddress}</strong>
            <p>{kingsWoodSite.addressNote}</p>
          </article>
          <article className="fact-card">
            <span className="fact-label">3D 정렬 anchor</span>
            <strong>{kingsWoodSite.anchorAddress}</strong>
            <p>{kingsWoodSite.coordinatesLabel}</p>
          </article>
          <article className="fact-card">
            <span className="fact-label">2차단지 핵심 정보</span>
            <strong>{kingsWoodSite.phase2Summary}</strong>
            <p>{kingsWoodSite.phase2SummaryNote}</p>
          </article>
        </div>
      </header>

      <main className="content-stack">
        <section className="scene-card">
          <div className="section-heading">
            <div>
              <span className="section-kicker">3D Viewer</span>
              <h2>Google 3D 타일 + 2차단지 오버레이 정합</h2>
            </div>
            <div
              className={`status-pill ${runtime.mode}`}
              data-scene-mode={runtime.mode}
            >
              <strong>{activeStatus.label}</strong>
              <span>{runtime.message}</span>
            </div>
          </div>

          <div className="toolbar-bar">
            <div className="preset-row" role="toolbar" aria-label="카메라 프리셋">
              {(Object.entries(kingsWoodSite.cameraPresets) as [
                CameraPresetName,
                (typeof kingsWoodSite.cameraPresets)[CameraPresetName],
              ][]).map(([preset, presetConfig]) => (
                <button
                  className={`preset-button ${
                    viewPreset === preset ? 'active' : ''
                  }`}
                  data-camera-preset={preset}
                  key={preset}
                  onClick={() => handlePresetChange(preset)}
                  type="button"
                >
                  <strong>{presetConfig.label}</strong>
                  <span>{presetConfig.description}</span>
                </button>
              ))}
            </div>

            <button className="ghost-button" onClick={handleResetView} type="button">
              기본 시점 리셋
            </button>
          </div>

          <div className="diagnostic-grid">
            <article className="diagnostic-chip">
              <span>Google 3D</span>
              <strong>
                {runtime.diagnostics.google3dReady ? '준비됨' : '미준비'}
              </strong>
            </article>
            <article className="diagnostic-chip">
              <span>Satellite</span>
              <strong>
                {runtime.diagnostics.googleSatelliteReady ? '준비됨' : '미준비'}
              </strong>
            </article>
            <article className="diagnostic-chip">
              <span>403 감지</span>
              <strong>{runtime.diagnostics.request403Count}건</strong>
            </article>
            <article className="diagnostic-chip">
              <span>현재 카메라</span>
              <strong>
                H {runtime.diagnostics.camera.headingDeg.toFixed(1)}° / P{' '}
                {runtime.diagnostics.camera.pitchDeg.toFixed(1)}°
              </strong>
            </article>
          </div>

          <div className="scene-frame">
            <KingsWoodScene
              calibration={overlayCalibration}
              calibrationMode={isCalibrationMode}
              onRuntimeChange={setRuntime}
              showOverlay={showOverlay}
              showLoadingMask={showSceneLoadingMask}
              viewCommandId={viewCommandId}
              viewPreset={viewPreset}
            />
          </div>

          <div className="controls-grid">
            <label className="control-card checkbox-card">
              <div>
                <span className="control-title">평면도 오버레이</span>
                <p>2차단지 경계와 lot 번호를 장면 위에 유지합니다.</p>
              </div>
              <input
                checked={showOverlay}
                onChange={(event) => setShowOverlay(event.target.checked)}
                type="checkbox"
              />
            </label>

            <label className="control-card">
              <div className="control-head">
                <span className="control-title">오버레이 투명도</span>
                <strong>{Math.round(overlayCalibration.opacity * 100)}%</strong>
              </div>
              <input
                aria-label="오버레이 투명도"
                max="1"
                min="0.25"
                onChange={(event) =>
                  updateCalibration((current) => ({
                    ...current,
                    opacity: Number(event.target.value),
                  }))
                }
                step="0.01"
                type="range"
                value={overlayCalibration.opacity}
              />
            </label>

            <label className="control-card">
              <div className="control-head">
                <span className="control-title">오버레이 스케일</span>
                <strong>{overlayScale.toFixed(2)}x</strong>
              </div>
              <input
                aria-label="오버레이 스케일"
                max="1.2"
                min="0.82"
                onChange={(event) => handleScaleChange(Number(event.target.value))}
                step="0.005"
                type="range"
                value={overlayScale}
              />
            </label>
          </div>

          {isCalibrationMode ? (
            <section className="calibration-panel">
              <div className="section-heading compact">
                <div>
                  <span className="section-kicker">Calibration</span>
                  <h2>오버레이 미세 보정</h2>
                </div>
              </div>

              <div className="calibration-grid">
                <article className="control-card">
                  <div className="control-head">
                    <span className="control-title">위치 미세조정</span>
                    <strong>{nudgeStepMeters}m</strong>
                  </div>
                  <div className="step-row">
                    {[0.5, 1, 2, 5].map((step) => (
                      <button
                        className={`mini-toggle ${
                          nudgeStepMeters === step ? 'active' : ''
                        }`}
                        key={step}
                        onClick={() => setNudgeStepMeters(step)}
                        type="button"
                      >
                        {step}m
                      </button>
                    ))}
                  </div>
                  <div className="nudge-grid">
                    <button onClick={() => nudgeCalibration(nudgeStepMeters, 0)} type="button">
                      북쪽 +
                    </button>
                    <button
                      onClick={() => nudgeCalibration(0, -nudgeStepMeters)}
                      type="button"
                    >
                      서쪽 +
                    </button>
                    <button
                      onClick={() => nudgeCalibration(0, nudgeStepMeters)}
                      type="button"
                    >
                      동쪽 +
                    </button>
                    <button
                      onClick={() => nudgeCalibration(-nudgeStepMeters, 0)}
                      type="button"
                    >
                      남쪽 +
                    </button>
                  </div>
                  <p>
                    도로 축과 공원 블록이 가장 잘 맞는 쪽으로 미세 이동한 뒤, 새로고침해도
                    draft가 유지됩니다.
                  </p>
                </article>

                <label className="control-card">
                  <div className="control-head">
                    <span className="control-title">회전</span>
                    <strong>{overlayCalibration.rotationDeg.toFixed(1)}°</strong>
                  </div>
                  <input
                    aria-label="오버레이 회전"
                    max="18"
                    min="-18"
                    onChange={(event) =>
                      updateCalibration((current) => ({
                        ...current,
                        rotationDeg: Number(event.target.value),
                      }))
                    }
                    step="0.1"
                    type="range"
                    value={overlayCalibration.rotationDeg}
                  />
                </label>

                <article className="control-card">
                  <div className="control-head">
                    <span className="control-title">현재 draft 값</span>
                    <strong>
                      {overlayCalibration.widthMeters.toFixed(1)}m x{' '}
                      {overlayCalibration.heightMeters.toFixed(1)}m
                    </strong>
                  </div>
                  <div className="metric-row">
                    <span className="metric-pill">
                      lat {overlayCalibration.centerLat.toFixed(7)}
                    </span>
                    <span className="metric-pill">
                      lon {overlayCalibration.centerLon.toFixed(7)}
                    </span>
                  </div>
                  <button
                    className="ghost-button compact"
                    onClick={handleResetCalibration}
                    type="button"
                  >
                    기본 보정값으로 리셋
                  </button>
                </article>
              </div>

              <div className="landmark-card">
                <strong>고정 랜드마크 기준</strong>
                <ul className="landmark-list">
                  {kingsWoodSite.calibrationLandmarks.map((landmark) => (
                    <li key={landmark}>{landmark}</li>
                  ))}
                </ul>
              </div>
            </section>
          ) : (
            <div className="note-banner">
              <strong>정확도 안내</strong>
              <p>
                현재 정렬은 공개 좌표와 현장 랜드마크를 기준으로 한
                <em> 시각 보정용 오버레이 </em>
                입니다. 더 미세한 보정이 필요하면 URL 뒤에
                <code>?calibrate=1</code>을 붙여 캘리브레이션 모드로 들어가면 됩니다.
              </p>
            </div>
          )}
        </section>

        <section className="split-section">
          <article className="reference-card">
            <div className="section-heading compact">
              <div>
                <span className="section-kicker">Reference</span>
                <h2>2차단지 평면도</h2>
              </div>
            </div>
            <img
              alt="킹스우드 2차단지 배치평면도"
              className="plan-image"
              src={phase2Plan}
            />
            <p className="reference-copy">
              일반 모드에서는 정리된 오버레이를 쓰고, 보정 모드에서는 같은 원본에서 파생한
              고대비 버전으로 도로와 공원 축을 더 쉽게 맞춥니다.
            </p>
          </article>

          <article className="reference-card">
            <div className="section-heading compact">
              <div>
                <span className="section-kicker">Master Plan</span>
                <h2>전체 단지 맥락</h2>
              </div>
            </div>
            <img
              alt="킹스우드 전체 단지배치도"
              className="plan-image"
              src={sitePlan}
            />
            <p className="reference-copy">
              2차단지 정합이 끝나면 같은 구조로 3차단지 확장, lot 카드, 부모님 사주 매칭 흐름을
              이어붙일 수 있습니다.
            </p>
          </article>
        </section>

        <section className="insight-card">
          <div className="section-heading compact">
            <div>
              <span className="section-kicker">Review Loop</span>
              <h2>Playwright 피드백 루프 기준</h2>
            </div>
          </div>

          <div className="next-grid">
            <article className="mini-card">
              <strong>고정 시점 캡처</strong>
              <p>
                `mobile-default`, `mobile-east`, `mobile-west`, `mobile-top`,
                `desktop-default`를 매 회차 같은 경로로 찍습니다.
              </p>
            </article>
            <article className="mini-card">
              <strong>자동 실패 기준</strong>
              <p>
                403 응답, Google 3D 미준비, 뷰어 에러 패널, 오버레이 미가시성, 가로
                오버플로우, 깨진 이미지를 자동으로 잡습니다.
              </p>
            </article>
            <article className="mini-card">
              <strong>모바일 회전 확인</strong>
              <p>
                Playwright가 모바일 캔버스에 터치 드래그를 보내고, 실제 카메라 heading/pitch
                값이 달라졌는지 같이 기록합니다.
              </p>
            </article>
            <article className="mini-card">
              <strong>최신 결과 고정</strong>
              <p>
                각 회차는 `.artifacts/playwright-review/runs/` 아래에 남기고, `latest/`
                가 가장 최근 아티팩트를 가리키게 합니다.
              </p>
            </article>
          </div>
        </section>

        <section className="insight-card">
          <div className="section-heading compact">
            <div>
              <span className="section-kicker">Setup</span>
              <h2>Google 3D를 안정적으로 보려면</h2>
            </div>
          </div>

          <ol className="setup-list">
            <li>Google Cloud에서 Map Tiles API를 켜고 이 프로젝트 전용 API 키를 발급합니다.</li>
            <li>
              로컬 개발용 referrer에 <code>http://localhost:4173/*</code> 와{' '}
              <code>http://localhost:5173/*</code> 를 넣어 주세요.
            </li>
            <li>
              루트의 <code>.env.local</code> 에{' '}
              <code>VITE_GOOGLE_MAPS_API_KEY=발급받은키</code> 를 넣습니다.
            </li>
          </ol>
          <p className="setup-footnote">{activeStatus.detail}</p>
        </section>
      </main>

      <pre className="review-diagnostics" data-scene-mode={runtime.mode}>
        {JSON.stringify(reviewPayload)}
      </pre>
    </div>
  )
}

export default App
