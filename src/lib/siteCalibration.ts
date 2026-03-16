import type { OverlayCalibration } from '../data/site'

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

export function buildZoneRectangleDegrees(
  calibration: OverlayCalibration,
  southFraction: number,
  northFraction: number,
): { east: number; north: number; south: number; west: number } {
  const lonDelta = metersToLongitudeDegrees(calibration.widthMeters / 2, calibration.centerLat)
  const latDelta = metersToLatitudeDegrees(calibration.heightMeters / 2)
  const southEdgeLat = calibration.centerLat - latDelta
  const heightDeg = metersToLatitudeDegrees(calibration.heightMeters)

  return {
    east: calibration.centerLon + lonDelta,
    north: southEdgeLat + northFraction * heightDeg,
    south: southEdgeLat + southFraction * heightDeg,
    west: calibration.centerLon - lonDelta,
  }
}
