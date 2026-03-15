import { useEffect, useEffectEvent, useRef } from 'react'
import * as Cesium from 'cesium'
import phase2Overlay from '/phase2-overlay.png'
import {
  kingsWoodSite,
  type CameraPresetName,
  type OverlayCalibration,
} from '../data/site'
import {
  metersToLatitudeDegrees,
  metersToLongitudeDegrees,
} from '../lib/siteCalibration'

export type SceneRuntimeMode =
  | 'loading'
  | 'google3d-ready'
  | 'google-satellite-only'
  | 'error'

export type SceneDiagnostics = {
  camera: {
    headingDeg: number
    pitchDeg: number
    preset: CameraPresetName
    rangeMeters: number
  }
  google3dReady: boolean
  googleSatelliteReady: boolean
  hasApiKey: boolean
  lastError: string | null
  overlayVisible: boolean
  request403Count: number
  tileFailureCount: number
}

export type SceneRuntime = {
  diagnostics: SceneDiagnostics
  message: string
  mode: SceneRuntimeMode
}

type SceneDiagnosticsPatch = Partial<Omit<SceneDiagnostics, 'camera'>> & {
  camera?: Partial<SceneDiagnostics['camera']>
}

type KingsWoodSceneProps = {
  calibration: OverlayCalibration
  calibrationMode: boolean
  onRuntimeChange?: (runtime: SceneRuntime) => void
  showOverlay: boolean
  viewCommandId: number
  viewPreset: CameraPresetName
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }

    try {
      return JSON.stringify(error)
    } catch {
      return Object.prototype.toString.call(error)
    }
  }

  return String(error)
}

async function probeGoogleMapTilesSession(apiKey: string) {
  const response = await fetch(
    `https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(apiKey)}`,
    {
      body: JSON.stringify({
        language: 'ko-KR',
        mapType: 'satellite',
        overlay: false,
        region: 'KR',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )

  if (response.ok) {
    return {
      message: null,
      ok: true,
      status: response.status,
    }
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: {
          message?: string
        }
      }
    | null

  return {
    message:
      payload?.error?.message ??
      `Map Tiles session probe failed with status ${response.status}.`,
    ok: false,
    status: response.status,
  }
}

function buildOverlayRectangle(calibration: OverlayCalibration) {
  const lonDelta = metersToLongitudeDegrees(
    calibration.widthMeters / 2,
    calibration.centerLat,
  )
  const latDelta = metersToLatitudeDegrees(calibration.heightMeters / 2)

  return Cesium.Rectangle.fromDegrees(
    calibration.centerLon - lonDelta,
    calibration.centerLat - latDelta,
    calibration.centerLon + lonDelta,
    calibration.centerLat + latDelta,
  )
}

function buildTarget(calibration: OverlayCalibration) {
  return Cesium.Cartesian3.fromDegrees(
    calibration.centerLon,
    calibration.centerLat,
    0,
  )
}

function buildBoundingSphere(calibration: OverlayCalibration) {
  const radius = Math.max(calibration.widthMeters, calibration.heightMeters) * 0.85

  return new Cesium.BoundingSphere(buildTarget(calibration), radius)
}

function buildGoogleImageryRectangle(
  calibration: OverlayCalibration,
  paddingMeters = 900,
) {
  const lonDelta = metersToLongitudeDegrees(
    calibration.widthMeters / 2 + paddingMeters,
    calibration.centerLat,
  )
  const latDelta = metersToLatitudeDegrees(
    calibration.heightMeters / 2 + paddingMeters,
  )

  return Cesium.Rectangle.fromDegrees(
    calibration.centerLon - lonDelta,
    calibration.centerLat - latDelta,
    calibration.centerLon + lonDelta,
    calibration.centerLat + latDelta,
  )
}

function createInitialRuntime(
  hasApiKey: boolean,
  preset: CameraPresetName,
  overlayVisible: boolean,
): SceneRuntime {
  const presetConfig = kingsWoodSite.cameraPresets[preset]

  return {
    diagnostics: {
      camera: {
        headingDeg: presetConfig.heading,
        pitchDeg: presetConfig.pitch,
        preset,
        rangeMeters: presetConfig.range,
      },
      google3dReady: false,
      googleSatelliteReady: false,
      hasApiKey,
      lastError: null,
      overlayVisible,
      request403Count: 0,
      tileFailureCount: 0,
    },
    message: hasApiKey
      ? 'Google satellite 바닥지도와 photorealistic 3D를 준비하고 있습니다.'
      : 'Google Map Tiles API 키가 없어 장면을 준비할 수 없습니다.',
    mode: hasApiKey ? 'loading' : 'error',
  }
}

export function KingsWoodScene({
  calibration,
  calibrationMode,
  onRuntimeChange,
  showOverlay,
  viewCommandId,
  viewPreset,
}: KingsWoodSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const runtimeRef = useRef<SceneRuntime>(
    createInitialRuntime(
      Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()),
      viewPreset,
      showOverlay,
    ),
  )
  const initialCalibrationRef = useRef(calibration)
  const initialCalibrationModeRef = useRef(calibrationMode)
  const initialShowOverlayRef = useRef(showOverlay)
  const initialViewPresetRef = useRef(viewPreset)
  const overlayEntityRef = useRef<Cesium.Entity | null>(null)
  const overlayBackdropEntityRef = useRef<Cesium.Entity | null>(null)
  const outlineEntityRef = useRef<Cesium.Entity | null>(null)
  const markerEntityRef = useRef<Cesium.Entity | null>(null)
  const tilesetRef = useRef<Cesium.Cesium3DTileset | null>(null)
  const imageryProviderRef = useRef<Cesium.Google2DImageryProvider | null>(null)
  const targetRef = useRef<Cesium.Cartesian3>(buildTarget(calibration))
  const boundingSphereRef = useRef<Cesium.BoundingSphere>(
    buildBoundingSphere(calibration),
  )
  const tilesetFailureCleanupRef = useRef<(() => void) | null>(null)
  const cameraListenerCleanupRef = useRef<(() => void) | null>(null)
  const cameraSyncTimeoutRef = useRef<number | null>(null)

  const publishRuntime = useEffectEvent(
    (
      patch: Omit<Partial<SceneRuntime>, 'diagnostics'> & {
        diagnostics?: SceneDiagnosticsPatch
      },
    ) => {
      const current = runtimeRef.current
      const next: SceneRuntime = {
        diagnostics: {
          ...current.diagnostics,
          ...patch.diagnostics,
          camera: {
            ...current.diagnostics.camera,
            ...patch.diagnostics?.camera,
          },
        },
        message: patch.message ?? current.message,
        mode: patch.mode ?? current.mode,
      }

      runtimeRef.current = next
      onRuntimeChange?.(next)
    },
  )

  const syncCameraDiagnostics = useEffectEvent(() => {
    const viewer = viewerRef.current

    if (!viewer) {
      return
    }

    const rangeMeters = Cesium.Cartesian3.distance(
      viewer.camera.positionWC,
      targetRef.current,
    )

    publishRuntime({
      diagnostics: {
        camera: {
          headingDeg: Number(
            Cesium.Math.toDegrees(viewer.camera.heading).toFixed(2),
          ),
          pitchDeg: Number(Cesium.Math.toDegrees(viewer.camera.pitch).toFixed(2)),
          preset: runtimeRef.current.diagnostics.camera.preset,
          rangeMeters: Number(rangeMeters.toFixed(2)),
        },
      },
    })
  })

  const queueCameraDiagnostics = useEffectEvent(() => {
    if (cameraSyncTimeoutRef.current !== null) {
      return
    }

    cameraSyncTimeoutRef.current = window.setTimeout(() => {
      cameraSyncTimeoutRef.current = null
      syncCameraDiagnostics()
    }, 120)
  })

  const applyPreset = useEffectEvent(
    (preset: CameraPresetName, animate: boolean) => {
      const viewer = viewerRef.current

      if (!viewer) {
        return
      }

      const presetConfig = kingsWoodSite.cameraPresets[preset]

      viewer.camera.lookAt(
        targetRef.current,
        new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(presetConfig.heading),
          Cesium.Math.toRadians(presetConfig.pitch),
          presetConfig.range,
        ),
      )

      if (animate) {
        viewer.camera.flyToBoundingSphere(boundingSphereRef.current, {
          duration: 0.85,
          offset: new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(presetConfig.heading),
            Cesium.Math.toRadians(presetConfig.pitch),
            presetConfig.range,
          ),
        })
      }

      viewer.scene.requestRender()
      publishRuntime({
        diagnostics: {
          camera: {
            headingDeg: presetConfig.heading,
            pitchDeg: presetConfig.pitch,
            preset,
            rangeMeters: presetConfig.range,
          },
        },
      })
      queueCameraDiagnostics()
    },
  )

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) {
      return
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? ''
    const hasApiKey = apiKey.length > 0
    const prefer3dOnlyBase =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 820px), (pointer: coarse)').matches &&
      !initialCalibrationModeRef.current
    let isCancelled = false

    publishRuntime(
      createInitialRuntime(
        hasApiKey,
        initialViewPresetRef.current,
        initialShowOverlayRef.current,
      ),
    )

    const initializeScene = async () => {
      const viewer = new Cesium.Viewer(containerRef.current!, {
        animation: false,
        baseLayer: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: hasApiKey ? [new Cesium.GoogleGeocoderService({ key: apiKey })] : false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        scene3DOnly: true,
        sceneModePicker: false,
        selectionIndicator: false,
        showRenderLoopErrors: false,
        terrain: undefined,
        timeline: false,
      })

      viewerRef.current = viewer
      viewer.scene.postProcessStages.fxaa.enabled = true
      viewer.scene.globe.depthTestAgainstTerrain = true
      viewer.scene.globe.enableLighting = true
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0e1f19')
      viewer.scene.fog.enabled = true
      viewer.scene.highDynamicRange = true
      viewer.scene.screenSpaceCameraController.enableTranslate = false
      viewer.scene.screenSpaceCameraController.enableRotate = true
      viewer.scene.screenSpaceCameraController.enableTilt = true
      viewer.scene.screenSpaceCameraController.enableLook = true
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 180
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = 2600
      viewer.scene.camera.percentageChanged = 0.001

      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.show = true
      }

      ;(viewer.cesiumWidget.creditContainer as HTMLElement).style.pointerEvents =
        'auto'

      cameraListenerCleanupRef.current = viewer.camera.changed.addEventListener(() => {
        queueCameraDiagnostics()
      })

      viewer.scene.renderError.addEventListener((_scene, error) => {
        publishRuntime({
          diagnostics: {
            lastError: getErrorMessage(error),
          },
          message: '브라우저가 3D 장면 렌더링을 끝까지 유지하지 못했습니다.',
          mode: 'error',
        })
      })

      applyPreset(initialViewPresetRef.current, false)

      markerEntityRef.current = viewer.entities.add({
        label: {
          backgroundColor: Cesium.Color.fromCssColorString('#10241d').withAlpha(
            0.92,
          ),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          fillColor: Cesium.Color.WHITE,
          font: '700 18px "Noto Sans KR"',
          outlineColor: Cesium.Color.fromCssColorString('#0d1815'),
          outlineWidth: 4,
          pixelOffset: new Cesium.Cartesian2(0, -42),
          showBackground: true,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          text: initialCalibrationModeRef.current
            ? '킹스우드 2차단지 보정 중심'
            : '킹스우드 2차단지',
        },
        point: {
          color: Cesium.Color.fromCssColorString('#f2d9a5'),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          outlineColor: Cesium.Color.fromCssColorString('#1a4035'),
          outlineWidth: 3,
          pixelSize: 12,
        },
        position: buildTarget(initialCalibrationRef.current),
      })

      if (!hasApiKey) {
        publishRuntime({
          message:
            'Google Map Tiles API 키가 없어 satellite와 photorealistic 3D를 불러올 수 없습니다.',
          mode: 'error',
        })
        return
      }

      Cesium.GoogleMaps.defaultApiKey = apiKey

      const sessionProbe = await probeGoogleMapTilesSession(apiKey)

      if (!sessionProbe.ok) {
        const is403 = sessionProbe.status === 403

        publishRuntime({
          diagnostics: {
            lastError: sessionProbe.message,
            request403Count:
              runtimeRef.current.diagnostics.request403Count + (is403 ? 1 : 0),
          },
          message: is403
            ? 'Google Map Tiles API 세션 생성이 403으로 거절되었습니다. Map Tiles API 활성화와 결제 연결을 먼저 확인해 주세요.'
            : 'Google Map Tiles 세션을 만들지 못했습니다. API 설정을 확인해 주세요.',
          mode: 'error',
        })
        return
      }

      if (prefer3dOnlyBase) {
        publishRuntime({
          diagnostics: {
            googleSatelliteReady: false,
            lastError: null,
          },
          message:
            '모바일에서는 photorealistic 3D가 실제 배경 역할을 하도록 2D satellite 바닥지도 요청을 생략합니다.',
          mode: 'loading',
        })
      } else {
        try {
          const googleSatellite = await Cesium.Google2DImageryProvider.fromUrl({
            key: apiKey,
            language: 'ko-KR',
            mapType: 'satellite',
            maximumLevel: 18,
            rectangle: buildGoogleImageryRectangle(initialCalibrationRef.current),
            region: 'KR',
          })

          if (isCancelled) {
            return
          }

          imageryProviderRef.current = googleSatellite
          viewer.imageryLayers.addImageryProvider(
            googleSatellite as unknown as Cesium.ImageryProvider,
          )

          googleSatellite.errorEvent.addEventListener((error) => {
            const message = getErrorMessage(error)
            const is403 = message.includes('403')

            if (!is403) {
              return
            }

            publishRuntime({
              diagnostics: {
                googleSatelliteReady: false,
                lastError: message,
                request403Count:
                  runtimeRef.current.diagnostics.request403Count + (is403 ? 1 : 0),
                tileFailureCount:
                  runtimeRef.current.diagnostics.tileFailureCount + 1,
              },
              message: is403
                ? 'Google satellite 요청이 403으로 거절되었습니다. localhost referrer 제한을 먼저 확인해 주세요.'
                : 'Google satellite 타일 일부를 불러오지 못했습니다.',
              mode: runtimeRef.current.diagnostics.google3dReady
                ? 'google3d-ready'
                : 'google-satellite-only',
            })
          })

          publishRuntime({
            diagnostics: {
              googleSatelliteReady: true,
            },
            message:
              'Google satellite 바닥지도를 연결했습니다. photorealistic 3D를 이어서 불러옵니다.',
            mode: 'loading',
          })
        } catch (error) {
          if (isCancelled) {
            return
          }

          publishRuntime({
            diagnostics: {
              googleSatelliteReady: false,
              lastError: getErrorMessage(error),
            },
            message:
              'Google satellite 바닥지도를 불러오지 못했습니다. API 키와 referrer 제한을 확인해 주세요.',
            mode: 'error',
          })
        }
      }

      try {
        const tileset = await Cesium.createGooglePhotorealistic3DTileset(
          {
            key: apiKey,
            onlyUsingWithGoogleGeocoder: true,
          },
          {
            enableCollision: false,
            maximumScreenSpaceError: 8,
            showCreditsOnScreen: true,
          },
        )

        if (isCancelled) {
          return
        }

        tilesetRef.current = viewer.scene.primitives.add(tileset)

        const handleTileFailure = (error: unknown) => {
          const message = getErrorMessage(error)
          const is403 = message.includes('403')

          publishRuntime({
            diagnostics: {
              google3dReady: false,
              lastError: message,
              request403Count:
                runtimeRef.current.diagnostics.request403Count + (is403 ? 1 : 0),
              tileFailureCount:
                runtimeRef.current.diagnostics.tileFailureCount + 1,
            },
            message: is403
              ? 'Google photorealistic 3D 타일이 403으로 거절되었습니다. localhost referrer 제한을 다시 확인해 주세요.'
              : 'Google photorealistic 3D 타일 일부를 불러오지 못했습니다.',
            mode: runtimeRef.current.diagnostics.googleSatelliteReady
              ? 'google-satellite-only'
              : 'error',
          })
        }

        tileset.tileFailed.addEventListener(handleTileFailure)
        tilesetFailureCleanupRef.current = () => {
          tileset.tileFailed.removeEventListener(handleTileFailure)
        }

        publishRuntime({
          diagnostics: {
            google3dReady: true,
          },
          message:
            runtimeRef.current.diagnostics.googleSatelliteReady
              ? 'Google photorealistic 3D와 satellite 바닥지도를 모두 연결했습니다.'
              : 'Google photorealistic 3D를 중심으로 장면을 연결했습니다.',
          mode: 'google3d-ready',
        })

        viewer.scene.requestRender()
      } catch (error) {
        if (isCancelled) {
          return
        }

        publishRuntime({
          diagnostics: {
            google3dReady: false,
            lastError: getErrorMessage(error),
          },
          message:
            runtimeRef.current.diagnostics.googleSatelliteReady
              ? 'Google satellite는 연결됐지만 photorealistic 3D는 불러오지 못했습니다.'
              : 'Google 3D 장면을 불러오지 못했습니다. API 키와 브라우저 WebGL 상태를 확인해 주세요.',
          mode: runtimeRef.current.diagnostics.googleSatelliteReady
            ? 'google-satellite-only'
            : 'error',
        })
      }

      if (!isCancelled) {
        queueCameraDiagnostics()
      }
    }

    initializeScene().catch((error) => {
      console.error(error)
      publishRuntime({
        diagnostics: { lastError: getErrorMessage(error) },
        message: '브라우저에서 3D 장면을 만들지 못했습니다.',
        mode: 'error',
      })
    })

    return () => {
      isCancelled = true

      if (cameraSyncTimeoutRef.current !== null) {
        window.clearTimeout(cameraSyncTimeoutRef.current)
        cameraSyncTimeoutRef.current = null
      }

      tilesetFailureCleanupRef.current?.()
      tilesetFailureCleanupRef.current = null
      cameraListenerCleanupRef.current?.()
      cameraListenerCleanupRef.current = null

      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current

    if (!viewer) {
      return
    }

    targetRef.current = buildTarget(calibration)
    boundingSphereRef.current = buildBoundingSphere(calibration)

    if (markerEntityRef.current) {
      markerEntityRef.current.position = new Cesium.ConstantPositionProperty(
        targetRef.current,
      )

      if (markerEntityRef.current.label) {
        markerEntityRef.current.label.text = new Cesium.ConstantProperty(
          calibrationMode ? '킹스우드 2차단지 보정 중심' : '킹스우드 2차단지',
        )
      }
    }

    if (overlayBackdropEntityRef.current) {
      viewer.entities.remove(overlayBackdropEntityRef.current)
      overlayBackdropEntityRef.current = null
    }

    if (overlayEntityRef.current) {
      viewer.entities.remove(overlayEntityRef.current)
      overlayEntityRef.current = null
    }

    if (outlineEntityRef.current) {
      viewer.entities.remove(outlineEntityRef.current)
      outlineEntityRef.current = null
    }

    publishRuntime({
      diagnostics: {
        overlayVisible: showOverlay,
      },
    })

    if (!showOverlay) {
      applyPreset(viewPreset, false)
      return
    }

    const overlayRectangle = buildOverlayRectangle(calibration)
    const rotation = Cesium.Math.toRadians(calibration.rotationDeg)

    overlayBackdropEntityRef.current = viewer.entities.add({
      rectangle: {
        classificationType: Cesium.ClassificationType.BOTH,
        coordinates: overlayRectangle,
        material: Cesium.Color.fromCssColorString('#071411').withAlpha(
          calibrationMode ? 0.24 : 0.12,
        ),
        rotation,
        stRotation: rotation,
      },
    })

    overlayEntityRef.current = viewer.entities.add({
      rectangle: {
        classificationType: Cesium.ClassificationType.BOTH,
        coordinates: overlayRectangle,
        material: new Cesium.ImageMaterialProperty({
          color: Cesium.Color.WHITE.withAlpha(
            calibrationMode ? Math.max(calibration.opacity, 0.72) : calibration.opacity,
          ),
          image: phase2Overlay,
          transparent: true,
        }),
        rotation,
        stRotation: rotation,
      },
    })

    outlineEntityRef.current = viewer.entities.add({
      rectangle: {
        classificationType: Cesium.ClassificationType.BOTH,
        coordinates: overlayRectangle,
        fill: false,
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(
          calibrationMode ? '#9fe4c4' : '#f2d9a5',
        ).withAlpha(0.92),
        rotation,
        stRotation: rotation,
      },
    })

    applyPreset(viewPreset, false)
    viewer.scene.requestRender()
  }, [calibration, calibrationMode, showOverlay, viewPreset])

  useEffect(() => {
    if (!viewerRef.current) {
      return
    }

    applyPreset(viewPreset, viewCommandId > 0)
  }, [viewCommandId, viewPreset])

  return (
    <div className="viewer-shell">
      <div className="viewer-canvas" ref={containerRef} />
      <div className="viewer-overlay">
        <div className="viewer-overlay-card">
          <strong>{calibrationMode ? '보정 모드' : '현재 장면'}</strong>
          <p>
            {calibrationMode
              ? '도로 축과 공원 블록을 기준으로 위치, 회전, 스케일을 미세 보정한 뒤 새로고침해도 draft를 유지합니다.'
              : '한 손가락 드래그로 부지를 회전하고, 프리셋 버튼으로 기본·동측·서측·탑뷰를 빠르게 비교할 수 있습니다.'}
          </p>
        </div>
      </div>
    </div>
  )
}
