import { useState } from 'react'
import { api } from '../services/api'

const QUESTIONS = [
  'Do you use different passwords for different accounts?',
  'Is multi-factor authentication (MFA) enabled on your important accounts?',
  'Do you regularly update your phone and apps?',
  'Do you click links from unknown senders?',
  'Do you download APK files from unknown websites?',
  'Do you use public Wi-Fi for banking or sensitive transactions?',
  'Do you back up your important files regularly?',
]

export default function SafetyScore() {
  const [answers, setAnswers] = useState<(boolean | null)[]>(Array(QUESTIONS.length).fill(null))
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  async function submit() {
    if (answers.some(a => a === null)) { setError('Please answer all questions'); return }
    setError('')
    try {
      const r = await api.submitSafetyScore(answers as boolean[])
      setResult(r)
    } catch (e: any) { setError(e.message) }
  }

  const levelColor: Record<string, string> = { 'At Risk': '#FF4D6A', 'Needs Improvement': '#FFB020', 'Good': '#2ED47A', 'Excellent': '#2ED47A' }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <div className="text-teal text-[12.5px] font-semibold uppercase tracking-wide mb-2">Personal Assessment</div>
        <h1 className="font-display text-3xl font-bold mb-2">What's your Cyber Safety Score?</h1>
        <p className="text-muted text-[14px]">Answer 7 quick questions about your digital habits.</p>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        {QUESTIONS.map((q, i) => (
          <div key={i} className="glass p-4 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-[14px] flex-1 min-w-[200px]">{i + 1}. {q}</span>
            <div className="flex gap-2">
              {['Yes', 'No'].map(opt => {
                const val = opt === 'Yes'
                const selected = answers[i] === val
                return (
                  <button key={opt} onClick={() => setAnswers(a => { const c = [...a]; c[i] = val; return c })}
                    className="px-4 py-1.5 rounded-full text-[12.5px] font-semibold border"
                    style={selected ? { borderColor: val ? '#2ED47A' : '#FF4D6A', color: val ? '#2ED47A' : '#FF4D6A', background: (val ? '#2ED47A' : '#FF4D6A') + '1a' } : { borderColor: 'rgba(255,255,255,0.08)', color: '#8B93A7' }}>
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="text-danger text-sm mb-4">{error}</div>}
      <button onClick={submit} className="btn btn-primary w-full mb-8">Calculate My Score</button>

      {result && (
        <div className="glass p-7 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-[140px] h-[140px] rounded-full flex items-center justify-center border-4" style={{ borderColor: levelColor[result.level] }}>
              <div className="text-center">
                <div className="font-display font-bold text-3xl" style={{ color: levelColor[result.level] }}>{result.score}</div>
                <div className="text-[10px] text-muted">/ 100</div>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-full text-[12.5px] font-bold" style={{ background: levelColor[result.level] + '22', color: levelColor[result.level] }}>{result.level}</span>
          </div>
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-[11.5px] font-semibold text-safe mb-2">STRONG AREAS</div>
                <ul className="flex flex-col gap-1.5 text-[13px]">{result.strong_areas.map((s: string, i: number) => <li key={i}>✓ {s}</li>)}</ul>
              </div>
              <div>
                <div className="text-[11.5px] font-semibold text-danger mb-2">NEEDS IMPROVEMENT</div>
                <ul className="flex flex-col gap-1.5 text-[13px]">{result.weak_areas.map((s: string, i: number) => <li key={i}>! {s}</li>)}</ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
