import { useState } from 'react'
import { Upload, Video as VideoIcon, AlertTriangle } from 'lucide-react'
import { api } from '../services/api'

export default function AIVideoAnalyzer() {
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function pickFile(f: File) {
    setFile(f); setResult(null); setError('')
    setPreview(URL.createObjectURL(f))
  }

  async function analyze() {
    if (!file) return
    setLoading(true); setError('')
    try {
      const r = await api.analyzeVideo(file)
      setResult(r)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const classColor: Record<string, string> = {
    'Likely Authentic': '#2ED47A', 'Inconclusive': '#FFB020', 'Possibly AI-Generated': '#FFB020',
    'Likely AI-Generated': '#FF4D6A', 'Possible Deepfake': '#FF4D6A', 'High Deepfake Risk': '#FF2748',
  }
  const segColor: Record<string, string> = { safe: '#2ED47A', medium: '#FFB020', high: '#FF4D6A' }

  return (
    <div>
      <div className="mb-8">
        <div className="text-violet text-[12.5px] font-semibold uppercase tracking-wide mb-2">AI Content Analyzer</div>
        <h1 className="font-display text-3xl font-bold mb-2 flex items-center gap-3"><VideoIcon size={26} className="text-violet" /> AI Video Analyzer</h1>
        <p className="text-muted text-[14px]">Sample frames from a video to estimate deepfake / AI-generation risk.</p>
      </div>

      <div className="bg-warning/10 border border-warning/25 rounded-xl p-4 text-[12.5px] text-warning mb-6 flex gap-2">
        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
        AI-generated content detection is probabilistic and may produce incorrect results. Treat results as indicators, not absolute proof.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="glass border-2 border-dashed border-white/15 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer min-h-[260px]">
            {preview ? (
              <video src={preview} controls className="max-h-[200px] rounded-lg" />
            ) : (
              <>
                <Upload size={28} className="text-muted mb-3" />
                <div className="font-semibold text-[14px] mb-1">Click to upload a video</div>
                <div className="text-[12px] text-muted">MP4, WEBM, MOV — up to 100MB</div>
              </>
            )}
            <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={e => e.target.files?.[0] && pickFile(e.target.files[0])} />
          </label>
          {file && (
            <div className="text-[12px] text-muted mt-3 flex justify-between">
              <span>{file.name}</span><span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            </div>
          )}
          <button onClick={analyze} disabled={!file || loading} className="btn btn-primary w-full mt-4">
            {loading ? 'Extracting & analyzing frames…' : 'Analyze for AI-Generated Content'}
          </button>
          {error && <div className="text-danger text-sm mt-3">{error}</div>}
        </div>

        <div>
          {result ? (
            <div className="glass p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="font-display font-semibold text-lg">Analysis Result</span>
                <span className="px-3 py-1 rounded-full text-[12.5px] font-bold" style={{ background: (classColor[result.classification] || '#8B93A7') + '22', color: classColor[result.classification] || '#8B93A7' }}>
                  {result.classification}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-5 text-[13px] text-muted">
                <div>Deepfake Risk: <span className="text-white font-semibold">{result.deepfake_risk}%</span></div>
                <div>AI Probability: <span className="text-white font-semibold">{result.ai_probability}%</span></div>
                <div>Frames Analyzed: <span className="text-white font-semibold">{result.frames_analyzed}</span></div>
                <div>Suspicious Frames: <span className="text-white font-semibold">{result.suspicious_frame_count}</span></div>
              </div>

              <div className="mb-5">
                <div className="text-[12px] font-semibold text-muted mb-2">Timeline</div>
                <div className="flex gap-1 h-6 rounded-lg overflow-hidden">
                  {result.timeline.map((seg: any, i: number) => (
                    <div key={i} title={`${seg.timestamp}s — score ${seg.score}`} className="flex-1" style={{ background: segColor[seg.risk] }} />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted mt-1">
                  <span>0:00</span><span>{result.duration_seconds}s</span>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-border1 rounded-xl p-4 text-[13px] text-muted leading-relaxed">{result.explanation}</div>
            </div>
          ) : (
            <div className="glass p-6 text-muted text-[13.5px] flex items-center justify-center min-h-[260px] text-center">
              Upload a video and run analysis to see the deepfake risk, frame timeline, and detected indicators here.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
