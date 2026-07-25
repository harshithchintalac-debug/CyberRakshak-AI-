const BASE = '/api'

function getAccessToken() {
  return localStorage.getItem('cr_access_token')
}

let isRefreshing = false

async function request(path: string, options: RequestInit = {}, isRetry = false): Promise<any> {
  const token = getAccessToken()
  const headers: Record<string, string> = { ...(options.headers as any) }
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(BASE + path, { ...options, headers })
  } catch (err: any) {
    throw new Error(err?.message || 'Network error: Backend server is unreachable.')
  }

  if (!res.ok) {
    // Attempt auto refresh token flow on 401 Unauthorized
    if (res.status === 401 && !isRetry && !path.startsWith('/auth/login') && !path.startsWith('/auth/register') && !path.startsWith('/auth/refresh')) {
      const refreshToken = localStorage.getItem('cr_refresh_token')
      if (refreshToken && !isRefreshing) {
        isRefreshing = true
        try {
          const refreshRes = await fetch(BASE + '/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          })
          if (refreshRes.ok) {
            const tokens = await refreshRes.json()
            localStorage.setItem('cr_access_token', tokens.access_token)
            localStorage.setItem('cr_refresh_token', tokens.refresh_token)
            isRefreshing = false
            return request(path, options, true)
          }
        } catch {}
        isRefreshing = false
        localStorage.removeItem('cr_access_token')
        localStorage.removeItem('cr_refresh_token')
      } else if (!refreshToken) {
        localStorage.removeItem('cr_access_token')
      }
    }

    // Extract detailed error message
    let detail = `Request failed (${res.status} ${res.statusText || 'Error'})`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string' && data.detail.trim()) {
        detail = data.detail
      } else if (Array.isArray(data.detail) && data.detail.length > 0) {
        detail = data.detail.map((d: any) => d?.msg || d?.detail || (typeof d === 'string' ? d : JSON.stringify(d))).join(', ')
      } else if (typeof data.message === 'string' && data.message.trim()) {
        detail = data.message
      } else if (typeof data.error === 'string' && data.error.trim()) {
        detail = data.error
      } else if (data.detail) {
        detail = typeof data.detail === 'object' ? JSON.stringify(data.detail) : String(data.detail)
      }
    } catch {}

    throw new Error(detail)
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return res.json()
  return res
}

export const api = {
  // --- Auth ---
  register: (data: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  refresh: (refresh_token: string) => request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token }) }),
  forgotPassword: (email: string) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, new_password: string) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password }) }),

  // --- Users ---
  me: () => request('/users/me'),
  updateMe: (data: any) => request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (data: any) => request('/users/me/change-password', { method: 'POST', body: JSON.stringify(data) }),
  deleteAccount: (password: string) => request('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }),
  myStats: () => request('/users/me/stats'),

  // --- Scan ---
  scanUnified: (text: string) => request('/scan/unified', { method: 'POST', body: JSON.stringify({ text }) }),
  scanUrl: (url: string) => request('/scan/url', { method: 'POST', body: JSON.stringify({ url }) }),
  scanEmail: (body: string, sender: string, subject: string) => request('/scan/email', { method: 'POST', body: JSON.stringify({ body, sender, subject }) }),
  scanMessage: (text: string) => request('/scan/message', { method: 'POST', body: JSON.stringify({ text }) }),
  scanPassword: (password: string) => request('/scan/password', { method: 'POST', body: JSON.stringify({ password }) }),
  scanBreach: (email: string) => request('/scan/breach', { method: 'POST', body: JSON.stringify({ email }) }),
  scanFile: (file: File) => { const fd = new FormData(); fd.append('file', file); return request('/scan/file', { method: 'POST', body: fd }) },
  scanQr: (file: File) => { const fd = new FormData(); fd.append('file', file); return request('/scan/qr', { method: 'POST', body: fd }) },
  scanHistory: (limit = 30) => request(`/scan/history?limit=${limit}`),

  // --- AI Content ---
  analyzeImage: (file: File) => { const fd = new FormData(); fd.append('file', file); return request('/ai-image/analyze', { method: 'POST', body: fd }) },
  imageHistory: () => request('/ai-image/history'),
  analyzeVideo: (file: File) => { const fd = new FormData(); fd.append('file', file); return request('/ai-video/analyze', { method: 'POST', body: fd }) },
  videoHistory: () => request('/ai-video/history'),

  // --- Chat ---
  chatStatus: () => request('/chat/status'),
  conversations: () => request('/chat/conversations'),
  conversationMessages: (id: string) => request(`/chat/conversations/${id}/messages`),
  renameConversation: (id: string, title: string) => request(`/chat/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteConversation: (id: string) => request(`/chat/conversations/${id}`, { method: 'DELETE' }),

  // --- Dashboard ---
  dashboardSummary: () => request('/dashboard/summary'),
  submitSafetyScore: (answers: boolean[]) => request('/dashboard/safety-score', { method: 'POST', body: JSON.stringify({ answers }) }),

  // --- Admin ---
  adminStats: () => request('/admin/stats'),

  // --- Content ---
  news: (category?: string) => request(`/content/news${category && category !== 'All' ? `?category=${encodeURIComponent(category)}` : ''}`),
  incidents: () => request('/content/incidents'),
}

// Streaming chat uses raw fetch (SSE) since it needs incremental reads.
export async function streamChatMessage(
  message: string,
  conversationId: string | null,
  language: string,
  onToken: (t: string) => void,
  onConversationId: (id: string) => void,
  onDone: () => void,
  onError?: (message: string) => void,
  signal?: AbortSignal,
) {
  const token = getAccessToken()
  let res: Response
  try {
    res = await fetch(BASE + '/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ conversation_id: conversationId, message, language }),
      signal,
    })
  } catch (e) {
    onError?.('Could not reach the server. Check your connection and try again.')
    return
  }

  if (!res.ok) {
    let detail = 'Something went wrong. Please try again.'
    try { detail = (await res.json()).detail || detail } catch {}
    onError?.(detail)
    return
  }
  if (!res.body) {
    onError?.('No response received from the server.')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() || ''
      for (const block of blocks) {
        const lines = block.split('\n')
        const eventLine = lines.find(l => l.startsWith('event:'))
        const dataLine = lines.find(l => l.startsWith('data:'))
        const event = eventLine?.replace('event:', '').trim()
        let data = ''
        if (dataLine) {
          if (dataLine.startsWith('data: ')) data = dataLine.slice(6)
          else if (dataLine.startsWith('data:')) data = dataLine.slice(5)
        }
        if (event === 'conversation') onConversationId(data)
        else if (event === 'token') onToken(data.replace(/\\n/g, '\n'))
        else if (event === 'error') onError?.('The assistant hit an error partway through. You can retry your question.')
        else if (event === 'done') onDone()
      }
    }
  } catch (e: any) {
    if (e?.name !== 'AbortError') onError?.('Connection interrupted while receiving the response.')
  }
}

export { getAccessToken }
