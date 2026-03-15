import { useState } from 'react'
import phase2Plan from '../Phase2_Floor_Plan.png'
import sitePlan from '../Site_Plan.png'
import { KingsWoodScene, type SceneRuntime } from './components/KingsWoodScene'
import { kingsWoodSite } from './data/site'
import './App.css'

const statusCopy: Record<SceneRuntime['mode'], { label: string; detail: string }> = {
  loading: {
    label: '3D 로딩 중',
    detail: '킹스우드 현장 주변 3D 타일과 2차단지 오버레이를 불러오고 있습니다.',
  },
  google3d: {
    label: 'Google Photorealistic 3D',
    detail: 'Google 3D 타일 위에 2차단지 평면도 오버레이를 얹은 상태입니다.',
  },
  fallback: {
    label: 'Fallback 맵 모드',
    detail: 'Google 3D 타일 로딩이 어려워 기본 지도 위에 현장 오버레이만 보여주고 있습니다.',
  },
  error: {
    label: '장면 초기화 오류',
    detail: '브라우저가 WebGL을 지원하는지와 네트워크 연결 상태를 확인해 주세요.',
  },
}

function App() {
  const [showOverlay, setShowOverlay] = useState(true)
  const [overlayOpacity, setOverlayOpacity] = useState(0.72)
  const [overlayScale, setOverlayScale] = useState(1)
  const [runtime, setRuntime] = useState<SceneRuntime>({
    mode: 'loading',
    message: '장면 초기화 중',
  })

  const activeStatus = statusCopy[runtime.mode]

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="eyebrow-row">
          <span className="eyebrow">Kings Wood 3D Overlay</span>
          <span className="eyebrow subtle">모바일 우선 프로토타입</span>
        </div>
        <h1>킹스우드 2차단지를 실제 3D 지형 위에서 보는 현장형 웹사이트</h1>
        <p className="hero-copy">
          부모님이 검토 중인 킹스우드 부지를 스마트폰에서 바로 확인할 수 있도록,
          공개 좌표를 기준으로 3D 장면을 만들고
          <strong>
            <code>Phase2_Floor_Plan.png</code>의 2차단지 부분만
          </strong>
          반투명 오버레이로 얹었습니다.
        </p>

        <div className="hero-grid">
          <article className="fact-card">
            <span className="fact-label">입력 기준 주소</span>
            <strong>{kingsWoodSite.userAddress}</strong>
            <p>{kingsWoodSite.addressNote}</p>
          </article>
          <article className="fact-card">
            <span className="fact-label">3D 정렬 기준</span>
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
              <h2>구글 3D 타일 + 2차단지 오버레이</h2>
            </div>
            <div className={`status-pill ${runtime.mode}`}>
              <strong>{activeStatus.label}</strong>
              <span>{runtime.message}</span>
            </div>
          </div>

          <div className="scene-frame">
            <KingsWoodScene
              showOverlay={showOverlay}
              overlayOpacity={overlayOpacity}
              overlayScale={overlayScale}
              onRuntimeChange={setRuntime}
            />
          </div>

          <div className="controls-grid">
            <label className="control-card checkbox-card">
              <div>
                <span className="control-title">평면도 오버레이</span>
                <p>2차단지 경계와 lot 번호를 3D 위에 유지합니다.</p>
              </div>
              <input
                checked={showOverlay}
                onChange={(event) => setShowOverlay(event.target.checked)}
                type="checkbox"
              />
            </label>

            <label className="control-card">
              <div className="control-head">
                <span className="control-title">투명도</span>
                <strong>{Math.round(overlayOpacity * 100)}%</strong>
              </div>
              <input
                aria-label="오버레이 투명도"
                max="0.95"
                min="0.3"
                onChange={(event) => setOverlayOpacity(Number(event.target.value))}
                step="0.01"
                type="range"
                value={overlayOpacity}
              />
            </label>

            <label className="control-card">
              <div className="control-head">
                <span className="control-title">오버레이 스케일</span>
                <strong>{overlayScale.toFixed(2)}x</strong>
              </div>
              <input
                aria-label="오버레이 스케일"
                max="1.25"
                min="0.8"
                onChange={(event) => setOverlayScale(Number(event.target.value))}
                step="0.01"
                type="range"
                value={overlayScale}
              />
            </label>
          </div>

          <div className="note-banner">
            <strong>정확도 안내</strong>
            <p>
              현재 정렬은 공개 검색에서 확인한 좌표를 기준으로 한
              <em> 시각 보정용 오버레이 </em>
              입니다. 실제 설계, 계약, 측량 판단에는 지적도나 공식 좌표를 별도로 맞춰야 합니다.
            </p>
          </div>
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
              3D 장면에 올린 이미지는 이 평면도에서 제목, 범례, 배경을 정리한 뒤 사용했습니다.
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
              지금 구현은 2차단지 중심입니다. 이후 3차단지나 부모님 사주 기반 추천 흐름을 더할 때도 같은 구조로 확장할 수 있습니다.
            </p>
          </article>
        </section>

        <section className="insight-card">
          <div className="section-heading compact">
            <div>
              <span className="section-kicker">What&apos;s Next</span>
              <h2>다음 단계에서 바로 이어붙일 수 있는 것</h2>
            </div>
          </div>

          <div className="next-grid">
            {kingsWoodSite.nextSteps.map((step) => (
              <article className="mini-card" key={step.title}>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="insight-card">
          <div className="section-heading compact">
            <div>
              <span className="section-kicker">Setup</span>
              <h2>Google 3D 타일을 안정적으로 보려면</h2>
            </div>
          </div>

          <ol className="setup-list">
            <li>
              Google Cloud에서 Map Tiles API를 켜고 브라우저 referrer 제한이 걸린 키를 발급합니다.
            </li>
            <li>
              프로젝트 루트에 `.env.local`을 만들고 `VITE_GOOGLE_MAPS_API_KEY=발급받은키`를 넣습니다.
            </li>
            <li>
              GitHub Pages 배포 시에는 저장소 secret `VITE_GOOGLE_MAPS_API_KEY`를 추가하면 됩니다.
            </li>
          </ol>
          <p className="setup-footnote">{activeStatus.detail}</p>
        </section>
      </main>
    </div>
  )
}

export default App
