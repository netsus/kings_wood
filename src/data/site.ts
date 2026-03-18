export type OverlayCalibration = {
  centerLat: number
  centerLon: number
  heightMeters: number
  opacity: number
  rotationDeg: number
  widthMeters: number
}

export type CameraFocusOffsetMeters = {
  eastMeters: number
  northMeters: number
}

export type CameraPresetName = 'default' | 'east' | 'west' | 'top'

export const kingsWoodSite = {
  userAddress: '충청북도 옥천군 군북면 증약리 1483',
  addressNote:
    '가족이 검토 중인 후보지 주소를 기준 정보로 유지했고, 현재 장면은 현장 도로 축을 따라 시각 정합을 진행합니다.',
  anchorAddress: '충청북도 옥천군 군북면 증약리 405-6 일원',
  coordinatesLabel: '3D 정렬 anchor: 36.3620046, 127.5292708',
  center: {
    lat: 36.3620046,
    lon: 127.5292708,
  },
  overlayCalibration: {
    centerLat: 36.3612502,
    centerLon: 127.5304202,
    heightMeters: 485.8,
    opacity: 0.78,
    rotationDeg: -1.0,
    widthMeters: 680.9,
  } satisfies OverlayCalibration,
  cameraFocusOffsetMeters: {
    eastMeters: 0,
    northMeters: 200,
  } satisfies CameraFocusOffsetMeters,
  cameraPresets: {
    default: {
      description: '진입 도로와 상단 곡선 도로를 함께 보는 기본 각도',
      heading: 28.8,
      label: '기본',
      pitch: -46.3,
      range: 2000,
    },
    east: {
      description: '동측에서 생활시설 블록 방향으로 보는 각도',
      heading: 108,
      label: '동측',
      pitch: -34,
      range: 1300,
    },
    west: {
      description: '서측에서 공원 블록과 상단 도로를 보는 각도',
      heading: 298,
      label: '서측',
      pitch: -34,
      range: 1400,
    },
    top: {
      description: '배치평면과 도로 축 정합을 확인하는 탑뷰',
      heading: 0,
      label: '탑뷰',
      pitch: -88,
      range: 1100,
    },
  } satisfies Record<
    CameraPresetName,
    {
      description: string
      heading: number
      label: string
      pitch: number
      range: number
    }
  >,
  calibrationLandmarks: [
    '메인 진입 도로 축',
    '상단 곡선 도로와 막다른길 라인',
    '중앙 공원 면적 블록',
    '하단 생활시설 구역',
  ],
  phase2Summary: '174필지 · 55,283㎡',
  phase2SummaryNote: '제공된 평면도 기준의 2차단지 핵심 수치를 앱 첫 화면에 반영했습니다.',
  nextSteps: [
    {
      title: 'lot 선택 인터랙션',
      description:
        '오버레이 위에 후보 lot를 클릭 가능하게 올리고, lot 번호별 장단점을 카드로 연결할 수 있습니다.',
    },
    {
      title: '사주 매칭 결과',
      description:
        '부모님 출생 정보를 입력받아 lot별 해석 카드를 만들고, 결과를 이 3D 장면과 함께 묶을 수 있습니다.',
    },
    {
      title: '실측 보정',
      description:
        '정확한 지적도나 현장 GPS 좌표를 받으면 현재 시각 보정용 오버레이를 더 정확하게 맞출 수 있습니다.',
    },
    {
      title: 'GitHub Pages 배포',
      description:
        '이미 정적 배포 기준으로 구성해 두어서 저장소 secret만 넣으면 GitHub Actions로 바로 배포할 수 있습니다.',
    },
  ],
} as const

export type FengShuiZonePoint = { x: number; y: number }

export type FengShuiZone = {
  id: 'north' | 'center' | 'south'
  name: string
  color: string
  // 오버레이 이미지 기준 정규화 좌표 (3점 이상)
  // x: 0=서쪽 끝, 1=동쪽 끝  |  y: 0=남쪽 끝, 1=북쪽 끝
  polygon: FengShuiZonePoint[]
}

export type FengShuiZoneConfig = {
  zones: [FengShuiZone, FengShuiZone, FengShuiZone]
}

export type FengShuiAnalysis = {
  zoneId: FengShuiZone['id']
  zoneName: string
  rating: 1 | 2 | 3 | 4 | 5
  headline: string
  highlights: string[]
  cautions: string[]
  isReferenceOnly: true
}

// 개발자가 ?zone-editor=1 에서 직접 그린 뒤 Export 버튼으로 이 값을 업데이트
// pnpm run analyze:fengshui 로 풍수 분석 재실행
export const fengShuiZoneConfig: FengShuiZoneConfig = {
  zones: [
    { id: 'south', name: '남측 구역', color: '#e8a87c', polygon: [{ "x": 0.179, "y": 0.644 }, { "x": 0.17, "y": 0.51 }, { "x": 0.164, "y": 0.351 }, { "x": 0.149, "y": 0.314 }, { "x": 0.12, "y": 0.294 }, { "x": 0.136, "y": 0.264 }, { "x": 0.175, "y": 0.244 }, { "x": 0.207, "y": 0.258 }, { "x": 0.347, "y": 0.371 }, { "x": 0.331, "y": 0.403 }, { "x": 0.334, "y": 0.418 }, { "x": 0.363, "y": 0.439 }, { "x": 0.367, "y": 0.468 }, { "x": 0.395, "y": 0.507 }, { "x": 0.397, "y": 0.568 }, { "x": 0.39, "y": 0.592 }, { "x": 0.359, "y": 0.573 }, { "x": 0.342, "y": 0.6 }, { "x": 0.282, "y": 0.729 }] },
    { id: 'center', name: '중앙 구역', color: '#85c985', polygon: [{ "x": 0.368, "y": 0.677 }, { "x": 0.44, "y": 0.504 }, { "x": 0.381, "y": 0.452 }, { "x": 0.376, "y": 0.359 }, { "x": 0.452, "y": 0.353 }, { "x": 0.686, "y": 0.419 }, { "x": 0.692, "y": 0.476 }, { "x": 0.692, "y": 0.522 }, { "x": 0.454, "y": 0.745 }] },
    { id: 'north', name: '북측 구역', color: '#7cbde8', polygon: [{ "x": 0.509, "y": 0.787 }, { "x": 0.535, "y": 0.702 }, { "x": 0.782, "y": 0.473 }, { "x": 0.852, "y": 0.474 }, { "x": 0.939, "y": 0.578 }, { "x": 0.939, "y": 0.801 }, { "x": 0.918, "y": 0.863 }, { "x": 0.895, "y": 0.89 }, { "x": 0.869, "y": 0.903 }, { "x": 0.797, "y": 0.905 }] },
  ],
}
