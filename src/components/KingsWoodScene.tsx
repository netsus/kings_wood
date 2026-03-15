import { useEffect, useEffectEvent, useRef } from 'react'
import * as Cesium from 'cesium'
import phase2Overlay from '/phase2-overlay.png'
import { kingsWoodSite } from '../data/site'

export type SceneRuntime = {
  mode: 'loading' | 'google3d' | 'fallback' | 'error'
  message: string
}

type KingsWoodSceneProps = {
  showOverlay: boolean
  overlayOpacity: number
  overlayScale: number
  onRuntimeChange?: (runtime: SceneRuntime) => void
}

function metersToLatitudeDegrees(meters: number) {
  return meters / 111_320
}

function metersToLongitudeDegrees(meters: number, latitude: number) {
  return meters / (111_320 * Math.cos(Cesium.Math.toRadians(latitude)))
}

function createOverlayRectangle(scale: number) {
  const widthMeters = kingsWoodSite.overlay.widthMeters * scale
  const heightMeters = kingsWoodSite.overlay.heightMeters * scale
  const lonDelta = metersToLongitudeDegrees(widthMeters / 2, kingsWoodSite.center.lat)
  const latDelta = metersToLatitudeDegrees(heightMeters / 2)

  return Cesium.Rectangle.fromDegrees(
    kingsWoodSite.center.lon - lonDelta,
    kingsWoodSite.center.lat - latDelta,
    kingsWoodSite.center.lon + lonDelta,
    kingsWoodSite.center.lat + latDelta,
  )
}

export function KingsWoodScene({
  showOverlay,
  overlayOpacity,
  overlayScale,
  onRuntimeChange,
}: KingsWoodSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const overlayEntityRef = useRef<Cesium.Entity | null>(null)
  const outlineEntityRef = useRef<Cesium.Entity | null>(null)
  const markerEntityRef = useRef<Cesium.Entity | null>(null)

  const emitRuntimeChange = useEffectEvent((runtime: SceneRuntime) => {
    onRuntimeChange?.(runtime)
  })

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) {
      return
    }

    let isCancelled = false

    const initializeScene = async () => {
      emitRuntimeChange({
        mode: 'loading',
        message: '장면을 준비하고 있습니다.',
      })

      const viewer = new Cesium.Viewer(containerRef.current!, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        terrain: undefined,
      })

      viewerRef.current = viewer
      viewer.scene.postProcessStages.fxaa.enabled = true
      viewer.scene.globe.depthTestAgainstTerrain = true
      viewer.scene.globe.enableLighting = true
      viewer.scene.fog.enabled = true
      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.show = true
      }

      ;(viewer.cesiumWidget.creditContainer as HTMLElement).style.pointerEvents = 'auto'
      viewer.scene.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          kingsWoodSite.center.lon,
          kingsWoodSite.center.lat,
          kingsWoodSite.camera.height,
        ),
        orientation: {
          heading: Cesium.Math.toRadians(kingsWoodSite.camera.heading),
          pitch: Cesium.Math.toRadians(kingsWoodSite.camera.pitch),
          roll: 0,
        },
      })

      viewer.imageryLayers.addImageryProvider(
        new Cesium.OpenStreetMapImageryProvider({
          url: 'https://tile.openstreetmap.org/',
          credit: 'OpenStreetMap contributors',
        }),
      )

      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()

        if (apiKey) {
          Cesium.GoogleMaps.defaultApiKey = apiKey
        }

        const tileset = await Cesium.createGooglePhotorealistic3DTileset(
          apiKey ? { key: apiKey } : undefined,
          {
            showCreditsOnScreen: true,
            enableCollision: false,
            maximumScreenSpaceError: 8,
          },
        )

        if (!isCancelled) {
          viewer.scene.primitives.add(tileset)
          emitRuntimeChange({
            mode: 'google3d',
            message: apiKey
              ? 'Google Map Tiles API 키로 3D 타일을 불러왔습니다.'
              : '기본 photorealistic 3D 경로로 장면을 불러왔습니다.',
          })
        }
      } catch (error) {
        console.error(error)
        emitRuntimeChange({
          mode: 'fallback',
          message: '3D 타일을 불러오지 못해 기본 지도 중심 보기로 전환했습니다.',
        })
      }

      if (!isCancelled) {
        markerEntityRef.current = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(
            kingsWoodSite.center.lon,
            kingsWoodSite.center.lat,
          ),
          point: {
            color: Cesium.Color.fromCssColorString('#f2d9a5'),
            outlineColor: Cesium.Color.fromCssColorString('#1a4035'),
            outlineWidth: 3,
            pixelSize: 12,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          label: {
            text: '킹스우드 2차단지',
            font: '700 18px "Noto Sans KR"',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.fromCssColorString('#0d1815'),
            outlineWidth: 4,
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#10241d').withAlpha(0.9),
            pixelOffset: new Cesium.Cartesian2(0, -42),
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        })
      }
    }

    initializeScene().catch((error) => {
      console.error(error)
      emitRuntimeChange({
        mode: 'error',
        message: '브라우저에서 3D 장면을 만들지 못했습니다.',
      })
    })

    return () => {
      isCancelled = true

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

    if (overlayEntityRef.current) {
      viewer.entities.remove(overlayEntityRef.current)
      overlayEntityRef.current = null
    }

    if (outlineEntityRef.current) {
      viewer.entities.remove(outlineEntityRef.current)
      outlineEntityRef.current = null
    }

    if (!showOverlay) {
      return
    }

    const overlayRectangle = createOverlayRectangle(overlayScale)

    overlayEntityRef.current = viewer.entities.add({
      rectangle: {
        classificationType: Cesium.ClassificationType.BOTH,
        coordinates: overlayRectangle,
        material: new Cesium.ImageMaterialProperty({
          color: Cesium.Color.WHITE.withAlpha(overlayOpacity),
          image: phase2Overlay,
          transparent: true,
        }),
      },
    })

    outlineEntityRef.current = viewer.entities.add({
      rectangle: {
        classificationType: Cesium.ClassificationType.BOTH,
        coordinates: overlayRectangle,
        fill: false,
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#f2d9a5').withAlpha(0.86),
      },
    })
  }, [overlayOpacity, overlayScale, showOverlay])

  return (
    <div className="viewer-shell">
      <div className="viewer-canvas" ref={containerRef} />
      <div className="viewer-overlay">
        <div className="viewer-overlay-card">
          <strong>현재 장면</strong>
          <p>
            핀 중심은 {kingsWoodSite.anchorAddress} 기준이며, 2차단지 평면도는
            북쪽 기준 축을 유지한 채 비율만 맞춘 오버레이입니다.
          </p>
        </div>
      </div>
    </div>
  )
}
