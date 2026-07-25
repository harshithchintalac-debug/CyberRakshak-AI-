import { useEffect, useState } from 'react'
import { api } from '../services/api'

export default function News() {
  const [items, setItems] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>(['All'])
  const [active, setActive] = useState('All')

  useEffect(() => { api.news(active).then(r => { setItems(r.items); setCategories(r.categories) }) }, [active])

  const sevColor: Record<string, string> = { Critical: '#FF4D6A', High: '#FF4D6A', Medium: '#FFB020', Low: '#2ED47A' }

  return (
    <div>
      <div className="mb-8">
        <div className="text-teal text-[12.5px] font-semibold uppercase tracking-wide mb-2">Stay Informed</div>
        <h1 className="font-display text-3xl font-bold mb-2">Cyber Threat News</h1>
        <p className="text-muted text-[14px]">Current scam and attack patterns, explained in plain language.</p>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {categories.map(c => (
          <button key={c} onClick={() => setActive(c)} className={`px-4 py-2 rounded-full text-[12.5px] font-medium border ${active === c ? 'border-teal text-teal bg-teal/10' : 'border-border1 text-muted'}`}>{c}</button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {items.map((n, i) => (
          <div key={i} className="glass p-5">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-md uppercase" style={{ background: sevColor[n.sev] + '22', color: sevColor[n.sev] }}>{n.sev}</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-border1 text-muted">{n.cat}</span>
              <span className="text-[11px] text-muted/60">{n.date}</span>
            </div>
            <div className="font-display font-semibold text-[15.5px] mb-2">{n.title}</div>
            <div className="text-[13px] text-muted leading-relaxed mb-3">{n.body}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
              <div><span className="block text-muted/60 uppercase text-[10.5px] mb-0.5">Who may be affected</span>{n.affected}</div>
              <div><span className="block text-muted/60 uppercase text-[10.5px] mb-0.5">How it works</span>{n.how}</div>
              <div className="sm:col-span-2"><span className="block text-muted/60 uppercase text-[10.5px] mb-0.5">What you should do</span>{n.do}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
