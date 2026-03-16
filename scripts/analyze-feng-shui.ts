#!/usr/bin/env tsx
/**
 * 풍수지리 분석 스크립트
 *
 * 사용법:
 *   ANTHROPIC_API_KEY=sk-... pnpm run analyze:fengshui
 *
 * src/data/site.ts 의 fengShuiZoneConfig 를 읽어 Claude Opus 4.6에게
 * 각 구역의 풍수지리 분석을 요청하고, 결과를 src/data/fengShuiAnalysis.ts 에 저장합니다.
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { fengShuiZoneConfig, kingsWoodSite } from '../src/data/site.js'
import type { FengShuiAnalysis, FengShuiZone } from '../src/data/site.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const FENG_SHUI_MODEL = 'claude-opus-4-6'

const SYSTEM_PROMPT = `당신은 한국의 풍수지리 전문가입니다.
주어진 부지 구역의 방위, 지형, 기운 흐름을 다양한 각도(배산임수, 사신사, 방위, 지기, 햇빛)로 분석하여 실용적인 해석을 제공합니다.

중요 원칙:
- 모든 분석은 참고용 해석이며 사실이 아님을 내용에 자연스럽게 반영합니다.
- 한국 전통 풍수지리 용어를 적절히 사용하되, 이해하기 쉽게 설명합니다.
- 장점과 주의사항을 균형 있게 제시합니다.

반드시 JSON 형식으로만 응답하고, 다른 텍스트는 포함하지 마세요:
{
  "rating": 1에서 5 사이의 정수,
  "headline": "풍수 핵심 특성을 담은 한 문장 (20자 이내)",
  "highlights": ["강점 1 (30자 이내)", "강점 2 (30자 이내)", "강점 3 (30자 이내)"],
  "cautions": ["주의사항 1 (30자 이내)", "주의사항 2 (30자 이내)"]
}`

function buildZonePrompt(zone: FengShuiZone): string {
  const directionLabel = { north: '북측', center: '중앙', south: '남측' }[zone.id]
  const heightPerZone =
    kingsWoodSite.overlayCalibration.heightMeters * (zone.northFraction - zone.southFraction)
  const southPct = Math.round(zone.southFraction * 100)
  const northPct = Math.round(zone.northFraction * 100)

  return `부지 정보:
- 주소: ${kingsWoodSite.userAddress} (킹스우드 2차단지)
- 지역: 충청북도 옥천군 군북면 — 내륙 산간 계곡 지형
- 부지 전체 규모: ${kingsWoodSite.overlayCalibration.widthMeters}m × ${kingsWoodSite.overlayCalibration.heightMeters}m (${kingsWoodSite.phase2Summary})
- 부지 방위: 오버레이 기준 -1° 회전 (거의 정남북 방향)
- 중심 좌표: 위도 ${kingsWoodSite.overlayCalibration.centerLat}, 경도 ${kingsWoodSite.overlayCalibration.centerLon}

분석 구역: ${zone.name} (${directionLabel})
- 구역 위치: 전체 부지의 ${southPct}%~${northPct}% 구간 (남→북 기준)
- 구역 규모: 폭 약 ${kingsWoodSite.overlayCalibration.widthMeters}m × 깊이 약 ${Math.round(heightPerZone)}m

이 구역을 풍수지리 관점에서 분석해 주세요.
배산임수(산과 물의 관계), 방위별 햇빛과 바람, 지기(땅의 기운), 거주 적합성을 종합적으로 평가합니다.
JSON 형식으로만 응답하세요.`
}

async function analyzeZone(
  client: Anthropic,
  zone: FengShuiZone,
  index: number,
  total: number,
): Promise<FengShuiAnalysis> {
  console.log(`[${index + 1}/${total}] ${zone.name} 분석 중...`)

  const message = await client.messages.create({
    max_tokens: 600,
    messages: [{ content: buildZonePrompt(zone), role: 'user' }],
    model: FENG_SHUI_MODEL,
    system: SYSTEM_PROMPT,
  })

  const rawText = message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')

  let parsed: { rating: number; headline: string; highlights: string[]; cautions: string[] }

  try {
    // JSON 블록 안에 있을 수 있는 경우 처리
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
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY 환경변수가 필요합니다.')
    console.error('   사용법: ANTHROPIC_API_KEY=sk-... pnpm run analyze:fengshui')
    process.exit(1)
  }

  const client = new Anthropic({ apiKey })
  const zones = fengShuiZoneConfig.zones
  const analyses: FengShuiAnalysis[] = []

  console.log(`\n🌿 킹스우드 2차단지 풍수지리 분석 시작 (${FENG_SHUI_MODEL})\n`)

  for (let i = 0; i < zones.length; i++) {
    const analysis = await analyzeZone(client, zones[i], i, zones.length)
    analyses.push(analysis)
    // rate limit 방지를 위한 짧은 대기
    if (i < zones.length - 1) await new Promise(r => setTimeout(r, 800))
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
