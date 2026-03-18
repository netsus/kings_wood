// 이 파일은 scripts/analyze-feng-shui.ts 가 자동 생성합니다.
// pnpm run analyze:fengshui 로 재생성하세요.
// 마지막 생성: 2026. 3. 16. 오후 9:27:20
import type { FengShuiAnalysis } from './site'

export const fengShuiAnalyses: FengShuiAnalysis[] = [
  {
    "cautions": [
      "계곡 지형 특성상 습기 정체 가능성 참고",
      "북풍 차단을 위한 후면 수목 배치 검토 필요"
    ],
    "headline": "남향 명당, 기운 모이는 중심 터",
    "highlights": [
      "부지 중심부로 사방의 지기가 고루 모이는 형국",
      "남향 배치에 유리하여 일조량이 풍부한 구역",
      "배산임수 흐름의 중간 지대로 기운 순환이 양호"
    ],
    "isReferenceOnly": true,
    "rating": 4,
    "zoneId": "south",
    "zoneName": "남측 구역"
  },
  {
    "cautions": [
      "계곡 중앙부 습기 정체 가능성 점검 필요",
      "전후 경사도에 따른 배수 방향 확인 권장"
    ],
    "headline": "사방 산세 품은 중앙 명당터",
    "highlights": [
      "부지 중심부로 사방 산세의 기운이 모이는 지점",
      "정남북 배치로 채광과 통풍 조건이 양호한 편",
      "내륙 계곡 지형이 바람을 막아 안정감을 줄 수 있음"
    ],
    "isReferenceOnly": true,
    "rating": 4,
    "zoneId": "center",
    "zoneName": "중앙 구역"
  },
  {
    "cautions": [
      "북측 상단부는 겨울 북풍 노출 가능성 있음",
      "계곡 지형 특성상 습기 관리에 유의 필요"
    ],
    "headline": "산을 등진 안정된 북측 명당",
    "highlights": [
      "북쪽 산세가 뒤를 받쳐 배산 조건 양호",
      "내륙 계곡 지형으로 지기가 모이는 형국",
      "정남북 방위로 남향 채광 확보에 유리"
    ],
    "isReferenceOnly": true,
    "rating": 4,
    "zoneId": "north",
    "zoneName": "북측 구역"
  }
] satisfies FengShuiAnalysis[]
