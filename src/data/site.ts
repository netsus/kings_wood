export const kingsWoodSite = {
  userAddress: '충청북도 옥천군 군북면 증약리 1483',
  addressNote: '가족이 검토 중인 후보지 주소를 기준 정보로 유지했습니다.',
  anchorAddress: '충청북도 옥천군 군북면 증약리 405-6 일원',
  coordinatesLabel: '3D 정렬 anchor: 36.3620046, 127.5292708',
  center: {
    lat: 36.3620046,
    lon: 127.5292708,
  },
  camera: {
    heading: 24,
    pitch: -48,
    height: 900,
  },
  overlay: {
    heightMeters: 316,
    widthMeters: 470,
  },
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
