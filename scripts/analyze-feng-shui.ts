#!/usr/bin/env tsx
/**
 * 풍수지리 분석 스크립트
 *
 * 사용법:
 *   pnpm run analyze:fengshui
 *
 * src/data/site.ts 의 fengShuiZoneConfig 를 읽어 .claude/agents/fengshui-expert.md 서브에이전트에게
 * 각 구역의 풍수지리 분석을 요청하고, 결과를 src/data/fengShuiAnalysis.ts 에 저장합니다.
 */

import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { fengShuiZoneConfig, kingsWoodSite } from '../src/data/site.js'
import type { FengShuiAnalysis, FengShuiZone } from '../src/data/site.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function buildZonePrompt(zone: FengShuiZone): string {
  const directionLabel = { north: '북측', center: '중앙', south: '남측' }[zone.id]
  const ys = zone.polygon.map(p => p.y)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const heightPerZone = Math.round(
    kingsWoodSite.overlayCalibration.heightMeters * (maxY - minY),
  )
  const southPct = Math.round(minY * 100)
  const northPct = Math.round(maxY * 100)

  return `부지 정보:
- 주소: ${kingsWoodSite.userAddress} (킹스우드 2차단지)
- 지역: 충청북도 옥천군 군북면 — 내륙 산간 계곡 지형
- 부지 전체 규모: ${kingsWoodSite.overlayCalibration.widthMeters}m × ${kingsWoodSite.overlayCalibration.heightMeters}m (${kingsWoodSite.phase2Summary})
- 부지 방위: 오버레이 기준 -1° 회전 (거의 정남북 방향)
- 중심 좌표: 위도 ${kingsWoodSite.overlayCalibration.centerLat}, 경도 ${kingsWoodSite.overlayCalibration.centerLon}

분석 구역: ${zone.name} (${directionLabel})
- 구역 위치: 전체 부지의 ${southPct}%~${northPct}% 구간 (남→북 기준)
- 구역 규모: 폭 약 ${kingsWoodSite.overlayCalibration.widthMeters}m × 깊이 약 ${heightPerZone}m

이 구역을 풍수지리 관점에서 분석해 주세요.
배산임수(산과 물의 관계), 방위별 햇빛과 바람, 지기(땅의 기운), 거주 적합성을 종합적으로 평가합니다.
JSON 형식으로만 응답하세요.`
}

function analyzeZone(zone: FengShuiZone, index: number, total: number): FengShuiAnalysis {
  console.log(`[${index + 1}/${total}] ${zone.name} 분석 중...`)

  const stdout = execFileSync(
    'claude',
    [
      '-p', buildZonePrompt(zone),
      '--agent', 'fengshui-expert',
      '--output-format', 'json',
      '--no-session-persistence',
    ],
    { encoding: 'utf-8' },
  )

  // claude -p --output-format json 은 { result: "..." } 래퍼를 반환
  let rawText = stdout
  try {
    const wrapper = JSON.parse(stdout) as { result?: string }
    if (wrapper.result) rawText = wrapper.result
  } catch { /* plain text fallback */ }

  let parsed: { rating: number; headline: string; highlights: string[]; cautions: string[] }
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
  } catch {
    console.warn(`  ⚠ JSON 파싱 실패, 기본값 사용`)
    parsed = {
      cautions: [],
      headline: rawText.slice(0, 30),
      highlights: [],
      rating: 3,
    }
  }

  const analysis: FengShuiAnalysis = {
    cautions: parsed.cautions ?? [],
    headline: parsed.headline ?? '',
    highlights: parsed.highlights ?? [],
    isReferenceOnly: true,
    rating: Math.max(1, Math.min(5, Math.round(parsed.rating ?? 3))) as 1 | 2 | 3 | 4 | 5,
    zoneId: zone.id,
    zoneName: zone.name,
  }

  console.log(`  ✓ 완료: ${analysis.headline} (★${analysis.rating})`)
  return analysis
}

function formatAnalysisTs(analyses: FengShuiAnalysis[]): string {
  const json = JSON.stringify(analyses, null, 2)
  return `// 이 파일은 scripts/analyze-feng-shui.ts 가 자동 생성합니다.
// pnpm run analyze:fengshui 로 재생성하세요.
// 마지막 생성: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
import type { FengShuiAnalysis } from './site'

export const fengShuiAnalyses: FengShuiAnalysis[] = ${json} satisfies FengShuiAnalysis[]
`
}

async function main() {
  const zones = fengShuiZoneConfig.zones
  const analyses: FengShuiAnalysis[] = []

  console.log(`\n🌿 킹스우드 2차단지 풍수지리 분석 시작 (fengshui-expert 에이전트)\n`)

  for (let i = 0; i < zones.length; i++) {
    const analysis = analyzeZone(zones[i], i, zones.length)
    analyses.push(analysis)
  }

  const outputPath = path.resolve(__dirname, '../src/data/fengShuiAnalysis.ts')
  fs.writeFileSync(outputPath, formatAnalysisTs(analyses), 'utf-8')

  console.log(`\n✅ 분석 완료! ${outputPath} 에 저장됨`)
  console.log('   pnpm dev 로 결과를 확인하세요.\n')
}

main().catch(err => {
  console.error('❌ 오류:', err.message)
  process.exit(1)
})
