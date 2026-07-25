import { useEffect, useState } from 'react'
import { ChevronDown, AlertTriangle } from 'lucide-react'
import { api } from '../services/api'

export default function IncidentResponse() {
  const [items, setItems] = useState<any[]>([])
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => { api.incidents().then(r => setItems(r.items)) }, [])

  return (
    <div>
      <div className="glass p-6 mb-8 flex items-center justify-between flex-wrap gap-4" style={{ background: 'linear-gradient(135deg, rgba(255,77,106,0.15), rgba(255,176,32,0.1))', borderColor: 'rgba(255,77,106,0.3)' }}>
        <div>
          <div className="font-display font-bold text-xl mb-1">I Think I've Been Hacked — What Should I Do?</div>
          <div className="text-[13px] text-muted">Pick your situation below for clear, step-by-step emergency actions.</div>
        </div>
        <span className="px-3 py-1.5 rounded-full text-[12.5px] font-bold bg-danger/15 text-danger flex items-center gap-1.5"><AlertTriangle size={14} /> Emergency Mode</span>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((inc, i) => (
          <div key={i} className="glass overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-danger/15 text-danger flex items-center justify-center flex-shrink-0"><AlertTriangle size={16} /></div>
                <span className="font-semibold text-[14px]">{inc.title}</span>
              </div>
              <ChevronDown size={18} className={`transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && (
              <div className="px-5 pb-5 pl-16">
                <ul className="flex flex-col gap-2.5">
                  {inc.steps.map((s: string, j: number) => (
                    <li key={j} className="flex items-start gap-2.5 text-[13.5px] text-muted">
                      <span className="w-5 h-5 rounded-full bg-teal/15 text-teal text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{j + 1}</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
