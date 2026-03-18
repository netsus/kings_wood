import type { FengShuiZonePoint, OverlayCalibration } from '../data/site'

export const overlayCalibrationStorageKey =
  'kings-wood:phase2-overlay-calibration-v1'

export function metersToLatitudeDegrees(meters: number) {
  return meters / 111_320
}

export function metersToLongitudeDegrees(meters: number, latitude: number) {
  return meters / (111_320 * Math.cos((latitude * Math.PI) / 180))
}

export function deriveOverlayScale(
  calibration: OverlayCalibration,
  defaultCalibration: OverlayCalibration,
) {
  return calibration.widthMeters / defaultCalibration.widthMeters
}

export function detectCalibrationMode() {
  if (typeof window === 'undefined') {
    return false
  }

  return new URLSearchParams(window.location.search).get('calibrate') === '1'
}

export function loadOverlayCalibrationDraft(
  defaultCalibration: OverlayCalibration,
) {
  if (typeof window === 'undefined') {
    return defaultCalibration
  }

  const rawValue = window.localStorage.getItem(overlayCalibrationStorageKey)

  if (!rawValue) {
    return defaultCalibration
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<OverlayCalibration>

    return {
      centerLat: parsed.centerLat ?? defaultCalibration.centerLat,
      centerLon: parsed.centerLon ?? defaultCalibration.centerLon,
      heightMeters: parsed.heightMeters ?? defaultCalibration.heightMeters,
      opacity: parsed.opacity ?? defaultCalibration.opacity,
      rotationDeg: parsed.rotationDeg ?? defaultCalibration.rotationDeg,
      widthMeters: parsed.widthMeters ?? defaultCalibration.widthMeters,
    }
  } catch {
    return defaultCalibration
  }
}

export function saveOverlayCalibrationDraft(calibration: OverlayCalibration) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    overlayCalibrationStorageKey,
    JSON.stringify(calibration),
  )
}

export function resetOverlayCalibrationDraft() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(overlayCalibrationStorageKey)
}

// 오버레이 이미지 분율 좌표를 WGS84 lat/lon 으로 변환 (회전 보정 포함)
// x: 0=서쪽, 1=동쪽  |  y: 0=남쪽, 1=북쪽
export function buildZonePolygonLatLon(
  calibration: OverlayCalibration,
  polygon: FengShuiZonePoint[],
): Array<{ lat: number; lon: number }> {
  const lonDelta = metersToLongitudeDegrees(calibration.widthMeters / 2, calibration.centerLat)
  const latDelta = metersToLatitudeDegrees(calibration.heightMeters / 2)
  const westEdgeLon = calibration.centerLon - lonDelta
  const southEdgeLat = calibration.centerLat - latDelta
  const widthDeg = lonDelta * 2
  const heightDeg = latDelta * 2

  const θ = (calibration.rotationDeg * Math.PI) / 180
  const cosθ = Math.cos(θ)
  const sinθ = Math.sin(θ)
  const cx = calibration.centerLon
  const cy = calibration.centerLat

  return polygon.map(({ x, y }) => {
    const rawLon = westEdgeLon + x * widthDeg
    const rawLat = southEdgeLat + y * heightDeg
    const dLon = rawLon - cx
    const dLat = rawLat - cy
    return {
      lat: cy + dLon * sinθ + dLat * cosθ,
      lon: cx + dLon * cosθ - dLat * sinθ,
    }
  })
}

export function detectZoneEditorMode() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('zone-editor') === '1'
}
