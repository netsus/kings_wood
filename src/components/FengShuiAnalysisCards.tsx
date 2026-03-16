import type { FengShuiAnalysis, FengShuiZone } from '../data/site'

type Props = {
  activeZoneId: FengShuiZone['id'] | null
  analyses: FengShuiAnalysis[]
  onZoneSelect: (id: FengShuiZone['id']) => void
  zones: [FengShuiZone, FengShuiZone, FengShuiZone]
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="star-rating" aria-label={`별점 ${rating}점`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? 'star filled' : 'star'}>
          {i < rating ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}

function PlaceholderCard({ zone }: { zone: FengShuiZone }) {
  return (
    <div className="analysis-card analysis-card--placeholder">
      <div className="analysis-card-accent" style={{ background: zone.color }} />
      <div className="analysis-card-header">
        <span className="analysis-zone-badge" style={{ color: zone.color }}>
          {zone.name}
        </span>
      </div>
      <p className="analysis-placeholder-text">분석 대기 중</p>
      <p className="analysis-placeholder-hint">pnpm run analyze:fengshui 실행 후 결과가 표시됩니다</p>
    </div>
  )
}

export function FengShuiAnalysisCards({ activeZoneId, analyses, onZoneSelect, zones }: Props) {
  return (
    <div className="analysis-grid">
      {zones.map(zone => {
        const analysis = analyses.find(a => a.zoneId === zone.id)

        if (!analysis) {
          return <PlaceholderCard key={zone.id} zone={zone} />
        }

        const isActive = zone.id === activeZoneId

        return (
          <button
            key={zone.id}
            className={`analysis-card${isActive ? ' analysis-card--active' : ''}`}
            onClick={() => onZoneSelect(zone.id)}
            style={{ borderColor: isActive ? zone.color : undefined }}
          >
            <div className="analysis-card-accent" style={{ background: zone.color }} />

            <div className="analysis-card-header">
              <span className="analysis-zone-badge" style={{ color: zone.color }}>
                {zone.name}
              </span>
              <StarRating rating={analysis.rating} />
            </div>

            <p className="analysis-headline">{analysis.headline}</p>

            {analysis.highlights.length > 0 && (
              <ul className="analysis-list analysis-list--highlights">
                {analysis.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}

            {analysis.cautions.length > 0 && (
              <ul className="analysis-list analysis-list--cautions">
                {analysis.cautions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}

            <p className="analysis-disclaimer">
              ⚠ 풍수지리 참고용 해석이며, 사실적 정보와 혼동하지 마세요.
            </p>
          </button>
        )
      })}
    </div>
  )
}
