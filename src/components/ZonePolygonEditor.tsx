import { useCallback, useEffect, useRef, useState } from 'react'
import phase2Plan from '../../Phase2_Floor_Plan.png'
import type { FengShuiZone, FengShuiZoneConfig, FengShuiZonePoint } from '../data/site'

type Props = {
  onZonesChange: (zones: FengShuiZoneConfig['zones']) => void
  zones: FengShuiZoneConfig['zones']
}

// 첫 번째 점 근처인지 판정 (픽셀 단위, 클릭 닫기 허용 반경)
const CLOSE_RADIUS_PX = 14

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// canvas px → 이미지 분율 (y 반전: canvas 위쪽=0 → fraction 북쪽=1)
function toFraction(
  px: number,
  py: number,
  w: number,
  h: number,
): FengShuiZonePoint {
  return { x: px / w, y: 1 - py / h }
}

// 이미지 분율 → canvas px
function toPx(
  pt: FengShuiZonePoint,
  w: number,
  h: number,
): { px: number; py: number } {
  return { px: pt.x * w, py: (1 - pt.y) * h }
}

function renderCanvas(
  canvas: HTMLCanvasElement,
  zones: FengShuiZoneConfig['zones'],
  drawing: FengShuiZonePoint[],
  activeIdx: number,
  mousePos: { px: number; py: number } | null,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  // 완성된 폴리곤 렌더링
  zones.forEach((zone, idx) => {
    if (zone.polygon.length < 3) return

    const pts = zone.polygon.map(p => toPx(p, w, h))
    const isActive = idx === activeIdx

    ctx.beginPath()
    ctx.moveTo(pts[0].px, pts[0].py)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].px, pts[i].py)
    ctx.closePath()

    ctx.fillStyle = hexToRgba(zone.color, isActive ? 0.35 : 0.2)
    ctx.fill()
    ctx.strokeStyle = hexToRgba(zone.color, isActive ? 0.95 : 0.55)
    ctx.lineWidth = isActive ? 2.5 : 1.5
    ctx.setLineDash([])
    ctx.stroke()

    // 꼭짓점 표시
    pts.forEach(({ px, py }) => {
      ctx.beginPath()
      ctx.arc(px, py, isActive ? 5 : 3, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(zone.color, 0.9)
      ctx.fill()
    })

    // 구역 이름 중앙 라벨
    const cx = pts.reduce((s, p) => s + p.px, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.py, 0) / pts.length
    ctx.font = `bold ${isActive ? 14 : 12}px sans-serif`
    ctx.fillStyle = hexToRgba(zone.color, isActive ? 1 : 0.75)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(zone.name, cx, cy)
  })

  // 진행 중인 폴리곤 (점선)
  if (drawing.length > 0) {
    const activeZone = zones[activeIdx]
    const pts = drawing.map(p => toPx(p, w, h))

    ctx.beginPath()
    ctx.moveTo(pts[0].px, pts[0].py)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].px, pts[i].py)
    if (mousePos) ctx.lineTo(mousePos.px, mousePos.py)

    ctx.strokeStyle = hexToRgba(activeZone.color, 0.85)
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // 꼭짓점 원
    pts.forEach(({ px, py }, i) => {
      ctx.beginPath()
      ctx.arc(px, py, 6, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(activeZone.color, i === 0 ? 1 : 0.75)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    })

    // 첫 점 닫기 힌트
    if (drawing.length >= 3 && mousePos) {
      const first = toPx(drawing[0], w, h)
      const dist = Math.hypot(mousePos.px - first.px, mousePos.py - first.py)
      if (dist < CLOSE_RADIUS_PX * 2) {
        ctx.beginPath()
        ctx.arc(first.px, first.py, CLOSE_RADIUS_PX, 0, Math.PI * 2)
        ctx.strokeStyle = hexToRgba(activeZone.color, 0.9)
        ctx.lineWidth = 2
        ctx.setLineDash([3, 3])
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }
}

export function ZonePolygonEditor({ onZonesChange, zones }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [drawing, setDrawing] = useState<FengShuiZonePoint[]>([])
  const [mousePos, setMousePos] = useState<{ px: number; py: number } | null>(null)
  const [copied, setCopied] = useState(false)

  // canvas 크기를 wrapper에 맞게 동기화
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return
    const img = wrapper.querySelector('img')
    if (!img) return
    const rect = img.getBoundingClientRect()
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width
      canvas.height = rect.height
    }
  }, [])

  // 리렌더링마다 canvas 다시 그리기
  useEffect(() => {
    syncCanvasSize()
    const canvas = canvasRef.current
    if (!canvas) return
    renderCanvas(canvas, zones, drawing, activeIdx, mousePos)
  })

  // resize observer
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const ro = new ResizeObserver(() => syncCanvasSize())
    ro.observe(wrapper)
    return () => ro.disconnect()
  }, [syncCanvasSize])

  const getCanvasPoint = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): { px: number; py: number } => {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      return {
        px: e.clientX - rect.left,
        py: e.clientY - rect.top,
      }
    },
    [],
  )

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const { px, py } = getCanvasPoint(e)
      const fraction = toFraction(px, py, canvas.width, canvas.height)

      if (drawing.length >= 3) {
        // 첫 점 근처 클릭 → 폴리곤 닫기
        const first = toPx(drawing[0], canvas.width, canvas.height)
        const dist = Math.hypot(px - first.px, py - first.py)
        if (dist < CLOSE_RADIUS_PX) {
          const newZones = zones.map((z, i) =>
            i === activeIdx ? { ...z, polygon: [...drawing] } : z,
          ) as FengShuiZoneConfig['zones']
          onZonesChange(newZones)
          setDrawing([])
          return
        }
      }

      setDrawing(prev => [...prev, fraction])
    },
    [drawing, activeIdx, zones, onZonesChange, getCanvasPoint],
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (drawing.length < 3) return
      // 마지막 점 제거 (dblclick 시 click 이벤트가 2번 발생해서 1점 보정)
      const finalDrawing = drawing.slice(0, -1)
      if (finalDrawing.length < 3) return
      const newZones = zones.map((z, i) =>
        i === activeIdx ? { ...z, polygon: [...finalDrawing] } : z,
      ) as FengShuiZoneConfig['zones']
      onZonesChange(newZones)
      setDrawing([])
    },
    [drawing, activeIdx, zones, onZonesChange],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (drawing.length === 0) {
        setMousePos(null)
        return
      }
      setMousePos(getCanvasPoint(e))
    },
    [drawing.length, getCanvasPoint],
  )

  const handleMouseLeave = useCallback(() => setMousePos(null), [])

  const handleUndo = () => {
    setDrawing(prev => prev.slice(0, -1))
  }

  const handleClearZone = () => {
    setDrawing([])
    const newZones = zones.map((z, i) =>
      i === activeIdx ? { ...z, polygon: [] as FengShuiZonePoint[] } : z,
    ) as FengShuiZoneConfig['zones']
    onZonesChange(newZones)
  }

  const handleClearAll = () => {
    setDrawing([])
    const newZones = zones.map(z => ({ ...z, polygon: [] as FengShuiZonePoint[] })) as FengShuiZoneConfig['zones']
    onZonesChange(newZones)
  }

  const handleSwitchZone = (idx: number) => {
    // 그리던 중인 폴리곤 버리기
    setDrawing([])
    setActiveIdx(idx)
  }

  const handleExport = () => {
    const round = (n: number) => Math.round(n * 1000) / 1000
    const zonesTs = zones
      .map(
        z =>
          `    { id: '${z.id}', name: '${z.name}', color: '${z.color}', polygon: ${JSON.stringify(
            z.polygon.map(p => ({ x: round(p.x), y: round(p.y) })),
          )} }`,
      )
      .join(',\n')

    const code = `export const fengShuiZoneConfig: FengShuiZoneConfig = {\n  zones: [\n${zonesTs},\n  ],\n}`
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  const activeZone: FengShuiZone = zones[activeIdx]

  return (
    <div className="zone-editor">
      <div className="zone-editor-instructions">
        <strong>사용법</strong> — 구역 탭 선택 → 클릭으로 꼭짓점 추가 → 첫 점 클릭 또는
        더블클릭으로 완성. Export 후 <code>src/data/site.ts</code>에 붙여넣기.
      </div>

      <div className="zone-tabs" role="tablist">
        {zones.map((zone, idx) => (
          <button
            key={zone.id}
            className={`zone-tab${activeIdx === idx ? ' zone-tab--active' : ''}`}
            onClick={() => handleSwitchZone(idx)}
            role="tab"
            style={
              activeIdx === idx
                ? { borderBottomColor: zone.color, color: zone.color }
                : undefined
            }
            type="button"
          >
            <span
              className="zone-tab-dot"
              style={{ background: zone.color }}
            />
            {zone.name}
            {zone.polygon.length >= 3 && (
              <span className="zone-tab-check">✓</span>
            )}
          </button>
        ))}
      </div>

      <div className="zone-canvas-wrapper" ref={wrapperRef}>
        <img
          alt="킹스우드 2차단지 평면도"
          className="zone-plan-img"
          src={phase2Plan}
        />
        <canvas
          className="zone-draw-canvas"
          onDoubleClick={handleDoubleClick}
          onClick={handleCanvasClick}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          ref={canvasRef}
        />
      </div>

      {drawing.length > 0 && (
        <p className="zone-drawing-hint" style={{ color: activeZone.color }}>
          {drawing.length}개 점 추가됨
          {drawing.length >= 3
            ? ' — 첫 번째 점 클릭 또는 더블클릭으로 완성'
            : ` — ${3 - drawing.length}개 더 추가해야 닫기 가능`}
        </p>
      )}

      <div className="zone-editor-toolbar">
        <div className="zone-editor-toolbar-left">
          <button
            className="ghost-button compact"
            disabled={drawing.length === 0}
            onClick={handleUndo}
            type="button"
          >
            Undo
          </button>
          <button
            className="ghost-button compact"
            onClick={handleClearZone}
            type="button"
          >
            {activeZone.name} 지우기
          </button>
          <button
            className="ghost-button compact"
            onClick={handleClearAll}
            type="button"
          >
            전체 초기화
          </button>
        </div>

        <button
          className={`export-button${copied ? ' export-button--copied' : ''}`}
          onClick={handleExport}
          type="button"
        >
          {copied ? '✓ 복사됨!' : 'Export to Clipboard'}
        </button>
      </div>
    </div>
  )
}
