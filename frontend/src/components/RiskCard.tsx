import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Download } from 'lucide-react'

const RISK_COLOR: Record<string, string> = {
  safe: '#2ED47A', low: '#2ED47A', medium: '#FFB020', high: '#FF4D6A', critical: '#FF2748',
}
const RISK_LABEL: Record<string, string> = {
  safe: 'Safe', low: 'Low Risk', medium: 'Medium Risk', high: 'High Risk', critical: 'Critical',
}

function Gauge({ score, size = 170 }: { score: number, size?: number }) {
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const [offset, setOffset] = useState(c)
  useEffect(() => { const t = setTimeout(() => setOffset(c - (score / 100) * c), 50); return () => clearTimeout(t) }, [score])
  const color = score < 15 ? '#2ED47A' : score < 35 ? '#2ED47A' : score < 60 ? '#FFB020' : score < 85 ? '#FF4D6A' : '#FF2748'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display font-bold text-3xl" style={{ color }}>{score}</div>
        <div className="text-[11px] text-muted">/ 100</div>
      </div>
    </div>
  )
}

function IndicatorIcon({ level }: { level: string }) {
  if (level === 'safe' || level === 'low') return <CheckCircle2 size={15} className="text-safe mt-0.5 flex-shrink-0" />
  if (level === 'medium') return <AlertTriangle size={15} className="text-warning mt-0.5 flex-shrink-0" />
  return <XCircle size={15} className="text-danger mt-0.5 flex-shrink-0" />
}

export default function RiskCard({ result }: { result: any }) {
  if (!result) return null
  const risk = result.risk || 'medium'
  const color = RISK_COLOR[risk] || '#FFB020'
  const [showTech, setShowTech] = useState(false)

  function download() {
    const report = {
      scanId: 'CR-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      date: new Date().toISOString(), ...result,
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = report.scanId + '.json'; a.click()
  }

  return (
    <div className="glass p-7 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
      <div className="flex flex-col items-center gap-4">
        <Gauge score={result.score ?? 0} />
        <span className="px-4 py-2 rounded-full text-[13px] font-bold" style={{ background: color + '22', color }}>
          {RISK_LABEL[risk] || risk}
        </span>
        {typeof result.confidence === 'number' && (
          <div className="text-[12px] text-muted">Confidence: {result.confidence}%</div>
        )}
      </div>
      <div>
        {result.demo && (
          <div className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-warning/15 text-warning font-semibold mb-3">
            <AlertTriangle size={12} /> Demo Data — illustrative, not a live scan result
          </div>
        )}
        <h3 className="font-display font-semibold text-lg mb-1">{result.label}</h3>
        <div className="font-mono text-[12px] text-muted/70 mb-3 break-all">{result.target}</div>
        {result.extra?.scam_category && (
          <span className="inline-block px-3 py-1 rounded-full bg-violet/15 text-violet text-[12px] mb-3">
            Category: {result.extra.scam_category}
          </span>
        )}
        <ul className="flex flex-col gap-2 my-3">
          {(result.indicators || []).map((ind: [string, string], i: number) => (
            <li key={i} className="flex items-start gap-2 text-[13.5px]">
              <IndicatorIcon level={ind[0]} /> {ind[1]}
            </li>
          ))}
        </ul>
        <div className="bg-white/[0.03] border border-border1 rounded-xl p-4 text-[13.5px] leading-relaxed text-muted my-3">
          <strong className="text-white">In plain terms:</strong><br />{result.explanation}
        </div>
        <button onClick={() => setShowTech(s => !s)} className="text-[12px] px-3 py-2 rounded-lg border border-border1 text-muted hover:text-white">
          {showTech ? 'Hide' : 'Show'} technical details {showTech ? '▴' : '▾'}
        </button>
        {showTech && <pre className="mt-3 p-3 bg-black/25 rounded-xl font-mono text-[11.5px] text-muted whitespace-pre-wrap">{result.technical}</pre>}
        <div className="flex gap-3 mt-5 flex-wrap">
          <button onClick={download} className="btn btn-primary text-[13px] px-4 py-2.5"><Download size={14} /> Download Report</button>
        </div>
        {result.actions?.length > 0 && (
          <div className="mt-5">
            <div className="text-[12px] font-semibold text-muted mb-2">Recommended actions:</div>
            <ul className="flex flex-col gap-2">
              {result.actions.map((a: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-[13.5px]"><CheckCircle2 size={15} className="text-safe mt-0.5 flex-shrink-0" /> {a}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
