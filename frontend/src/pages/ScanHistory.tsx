import { useEffect, useState } from 'react'
import { api } from '../services/api'

const FILTERS = ['All', 'url', 'email', 'message', 'file', 'qr', 'password', 'breach']

export default function ScanHistory() {
  const [items, setItems] = useState<any[]>([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => { api.scanHistory(50).then(r => setItems(r.items)).finally(() => setLoading(false)) }, [])

  const filtered = filter === 'All' ? items : items.filter(i => i.kind === filter)

  function riskColor(r: string) { return ({ safe: '#2ED47A', low: '#2ED47A', medium: '#FFB020', high: '#FF4D6A', critical: '#FF2748' } as any)[r] || '#8B93A7' }

  function download(item: any) {
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `scan-${item._id}.json`; a.click()
  }

  return (
    <div>
      <div className="mb-8">
        <div className="text-teal text-[12.5px] font-semibold uppercase tracking-wide mb-2">Your Activity</div>
        <h1 className="font-display text-3xl font-bold mb-2">Scan History</h1>
        <p className="text-muted text-[14px]">Every scan you've run, linked to your account.</p>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full text-[12.5px] font-medium border ${filter === f ? 'border-teal text-teal bg-teal/10' : 'border-border1 text-muted'}`}>
            {f === 'All' ? 'All' : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <div className="text-muted">Loading…</div> : filtered.length === 0 ? (
        <div className="glass p-8 text-center text-muted text-[14px]">No scans found for this filter.</div>
      ) : (
        <div className="glass divide-y divide-border1">
          {filtered.map((item, i) => (
            <div key={i} className="flex items-center justify-between p-4 flex-wrap gap-2">
              <div>
                <div className="font-medium text-[13.5px]">{item.label}</div>
                <div className="text-[11.5px] text-muted font-mono truncate max-w-[280px]">{item.target}</div>
                <div className="text-[10.5px] text-muted/60 mt-0.5">{new Date(item.created_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ background: riskColor(item.risk) + '22', color: riskColor(item.risk) }}>{item.risk}</span>
                <button onClick={() => download(item)} className="text-[11.5px] text-muted hover:text-teal">Download</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
