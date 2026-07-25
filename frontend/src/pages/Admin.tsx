import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { api } from '../services/api'

export default function Admin() {
  const [stats, setStats] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => { api.adminStats().then(setStats).catch(e => setError(e.message)) }, [])

  const catData = stats ? Object.entries(stats.category_counts || {}).map(([k, v]) => ({ name: k, count: v })) : []

  return (
    <div>
      <div className="mb-8">
        <div className="text-teal text-[12.5px] font-semibold uppercase tracking-wide mb-2">Restricted Area</div>
        <h1 className="font-display text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted text-[14px]">Platform-wide threat statistics.</p>
      </div>

      {error && <div className="text-danger text-sm mb-6">{error} — this page requires an admin-role account.</div>}

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Stat label="Total Users" value={stats.total_users} />
            <Stat label="Total Scans" value={stats.total_scans} />
            <Stat label="Phishing Detections" value={stats.phishing_detections} color="#FF4D6A" />
            <Stat label="Malicious URLs" value={stats.malicious_urls} color="#FFB020" />
            <Stat label="Malware Detections" value={stats.malware_detections} color="#FF4D6A" />
            <Stat label="AI Image Analyses" value={stats.ai_image_analyses} color="#7C6CF0" />
            <Stat label="AI Video Analyses" value={stats.ai_video_analyses} color="#7C6CF0" />
          </div>

          <div className="glass p-6">
            <h4 className="font-display font-semibold mb-4">Threat Category Breakdown</h4>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={catData}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#8B93A7', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8B93A7', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#131A2B', border: '1px solid rgba(255,255,255,0.1)' }} />
                <Bar dataKey="count" fill="#00D9C0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, color = '#00D9C0' }: { label: string, value: number, color?: string }) {
  return (
    <div className="glass p-5 text-center">
      <div className="font-display font-bold text-2xl mb-1" style={{ color }}>{value}</div>
      <div className="text-[11.5px] text-muted">{label}</div>
    </div>
  )
}
