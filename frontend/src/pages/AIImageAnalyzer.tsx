import { useState } from 'react'
import { Upload, ImageIcon, AlertTriangle } from 'lucide-react'
import { api } from '../services/api'

export default function AIImageAnalyzer() {
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  function pickFile(f: File) {
    setFile(f); setResult(null); setError('')
    setPreview(URL.createObjectURL(f))
  }

  async function analyze() {
    if (!file) return
    setLoading(true); setError('')
    try {
      const r = await api.analyzeImage(file)
      setResult(r)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const classColor: Record<string, string> = {
    'Likely Authentic': '#2ED47A', 'Inconclusive': '#FFB020', 'Possibly AI-Generated': '#FFB020',
    'Likely AI-Generated': '#FF4D6A', 'Possibly Manipulated': '#FF4D6A',
  }

  return (
    <div>
      <div className="mb-8">
        <div className="text-violet text-[12.5px] font-semibold uppercase tracking-wide mb-2">AI Content Analyzer</div>
        <h1 className="font-display text-3xl font-bold mb-2 flex items-center gap-3"><ImageIcon size={26} className="text-violet" /> AI Image Analyzer</h1>
        <p className="text-muted text-[14px]">Check whether an image may be AI-generated or manipulated.</p>
      </div>

      <div className="bg-warning/10 border border-warning/25 rounded-xl p-4 text-[12.5px] text-warning mb-6 flex gap-2">
        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
        AI-generated content detection is probabilistic and may produce incorrect results. Treat results as indicators, not absolute proof.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) pickFile(f) }}
            className={`glass border-2 border-dashed ${dragOver ? 'border-teal' : 'border-white/15'} rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer min-h-[260px] transition-colors`}
          >
            {preview ? (
              <img src={preview} alt="preview" className="max-h-[200px] rounded-lg object-contain" />
            ) : (
              <>
                <Upload size={28} className="text-muted mb-3" />
                <div className="font-semibold text-[14px] mb-1">Drag & drop an image, or click to upload</div>
                <div className="text-[12px] text-muted">JPG, JPEG, PNG, WEBP</div>
              </>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => e.target.files?.[0] && pickFile(e.target.files[0])} />
          </label>
          {file && (
            <div className="text-[12px] text-muted mt-3 flex justify-between">
              <span>{file.name}</span><span>{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
          <button onClick={analyze} disabled={!file || loading} className="btn btn-primary w-full mt-4" >
            {loading ? 'Analyzing…' : 'Analyze for AI-Generated Content'}
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
              <div className="grid grid-cols-2 gap-4 mb-5">
                <Meter label="AI Probability" value={result.ai_probability} color="#FF4D6A" />
                <Meter label="Authenticity Confidence" value={result.authenticity_confidence} color="#2ED47A" />
              </div>
              <div className="text-[13px] text-muted mb-4">
                Resolution: {result.resolution} · Format: {result.format} · Size: {result.file_size_kb} KB
              </div>
              <div className="mb-4">
                <div className="text-[12px] font-semibold text-muted mb-2">Detected Indicators</div>
                <ul className="flex flex-col gap-1.5">
                  {result.indicators.map((ind: [string, string], i: number) => (
                    <li key={i} className="text-[13px]">• {ind[1]}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-white/[0.03] border border-border1 rounded-xl p-4 text-[13px] text-muted leading-relaxed">{result.explanation}</div>
            </div>
          ) : (
            <div className="glass p-6 text-muted text-[13.5px] flex items-center justify-center min-h-[260px] text-center">
              Upload an image and run analysis to see the AI-generation probability, authenticity confidence, and detected indicators here.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Meter({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[12px] text-muted mb-1.5"><span>{label}</span><span>{value}%</span></div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}
