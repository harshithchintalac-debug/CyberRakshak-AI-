import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { Send, Mic, Square, Volume2, VolumeX, Plus, Copy, AlertTriangle, Check } from 'lucide-react'
import { api, streamChatMessage } from '../services/api'

// code -> [display name, BCP-47 tag used for both SpeechSynthesis and
// SpeechRecognition]. Keep in sync with backend SUPPORTED_LANGUAGES.
const LANGUAGES: [string, string][] = [
  ['en-US', 'English'], ['hi-IN', 'Hindi'], ['te-IN', 'Telugu'], ['ta-IN', 'Tamil'],
  ['kn-IN', 'Kannada'], ['ml-IN', 'Malayalam'], ['mr-IN', 'Marathi'], ['bn-IN', 'Bengali'],
  ['gu-IN', 'Gujarati'], ['pa-IN', 'Punjabi'],
]
const LANG_STORAGE_KEY = 'cr_chat_language'

const QUICK_PROMPTS = [
  'Is this link safe?', 'I shared my OTP. What now?', 'My Instagram was hacked',
  'Someone sent me an APK', 'How do I secure my phone?',
]

interface Msg { role: 'user' | 'assistant'; content: string; error?: boolean }

/** Picks the closest available browser voice for a BCP-47 language tag:
 * exact match -> same base language (e.g. "hi" for "hi-IN") -> null (caller
 * falls back to the browser/OS default voice rather than failing). */
function pickVoice(voices: SpeechSynthesisVoice[], langTag: string): SpeechSynthesisVoice | null {
  if (!voices.length) return null
  const exact = voices.find(v => v.lang.toLowerCase() === langTag.toLowerCase())
  if (exact) return exact
  const base = langTag.split('-')[0].toLowerCase()
  const sameBase = voices.find(v => v.lang.toLowerCase().startsWith(base))
  if (sameBase) return sameBase
  return null
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    const existing = window.speechSynthesis.getVoices()
    if (existing.length) { resolve(existing); return }
    const onChange = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChange)
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', onChange)
    // Some browsers never fire voiceschanged if voices are already cached elsewhere.
    setTimeout(() => { onChange() }, 800)
  })
}

export default function AIAssistant() {
  const [params] = useSearchParams()
  const voiceMode = params.get('voice') === '1'

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [aiProvider, setAiProvider] = useState<string | null>(null)
  const [aiStatusLoaded, setAiStatusLoaded] = useState(false)
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_STORAGE_KEY) || 'en-US')
  const [autoSpeak, setAutoSpeak] = useState(voiceMode)
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'speaking'>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  const bodyRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastSentRef = useRef<{ text: string; at: number } | null>(null)
  const speechQueueRef = useRef<{ text: string; url?: string; voice?: SpeechSynthesisVoice }[]>([])
  const isSpeakingRef = useRef<boolean>(false)
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    api.chatStatus()
      .then(r => { setAiProvider(r.provider); setAiStatusLoaded(true) })
      .catch(() => { setAiProvider(null); setAiStatusLoaded(true) })
    loadVoices().then(v => setVoices(v))
    return () => {
      abortRef.current?.abort()
      cancelSpeech()
    }
  }, [])

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [messages])

  // Persist the selected language so it survives reloads/new sessions, and
  // stop any speech that's mid-flight in the old language.
  useEffect(() => {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
    cancelSpeech()
  }, [lang])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  function cancelSpeech() {
    speechQueueRef.current = []
    isSpeakingRef.current = false
    setVoiceState('idle')
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause()
      activeAudioRef.current = null
    }
  }

  function handleToggleAutoSpeak() {
    setAutoSpeak(prev => {
      const next = !prev
      if (!next) {
        cancelSpeech()
      }
      return next
    })
  }

  function chunkTextForTTS(text: string, maxLength: number): string[] {
    const words = text.split(' ')
    const chunks: string[] = []
    let currentChunk = ''
    for (const word of words) {
      if ((currentChunk + ' ' + word).trim().length <= maxLength) {
        currentChunk = (currentChunk + ' ' + word).trim()
      } else {
        if (currentChunk) chunks.push(currentChunk)
        currentChunk = word
      }
    }
    if (currentChunk) chunks.push(currentChunk)
    return chunks
  }

  function queueSpeech(text: string) {
    const plain = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[#*_`>-]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .trim()
    if (!plain) return

    const langBase = lang.split('-')[0].toLowerCase()
    const voice = pickVoice(voices, lang)
    const voiceLangBase = voice?.lang.split(/[-_]/)[0].toLowerCase()
    const hasNativeVoice = voice && voiceLangBase === langBase

    if (hasNativeVoice) {
      speechQueueRef.current.push({ text: plain, voice })
    } else {
      const chunks = chunkTextForTTS(plain, 150)
      for (const chunk of chunks) {
        const url = `/api/chat/tts?lang=${langBase}&text=${encodeURIComponent(chunk)}`
        speechQueueRef.current.push({ text: chunk, url })
      }
    }
    processSpeechQueue()
  }

  function processSpeechQueue() {
    if (isSpeakingRef.current || speechQueueRef.current.length === 0) return
    isSpeakingRef.current = true
    setVoiceState('speaking')

    const item = speechQueueRef.current[0]

    if (item.url) {
      const audio = new Audio(item.url)
      activeAudioRef.current = audio
      audio.onended = () => {
        speechQueueRef.current.shift()
        isSpeakingRef.current = false
        activeAudioRef.current = null
        setVoiceState('idle')
        processSpeechQueue()
      }
      audio.onerror = () => {
        speechQueueRef.current.shift()
        isSpeakingRef.current = false
        activeAudioRef.current = null
        setVoiceState('idle')
        processSpeechQueue()
      }
      audio.play().catch(err => {
        console.error('Audio play error:', err)
        speechQueueRef.current.shift()
        isSpeakingRef.current = false
        activeAudioRef.current = null
        setVoiceState('idle')
        processSpeechQueue()
      })
    } else {
      const utter = new SpeechSynthesisUtterance(item.text)
      utter.lang = lang
      if (item.voice) utter.voice = item.voice

      utter.onend = () => {
        speechQueueRef.current.shift()
        isSpeakingRef.current = false
        setVoiceState('idle')
        processSpeechQueue()
      }
      utter.onerror = () => {
        speechQueueRef.current.shift()
        isSpeakingRef.current = false
        setVoiceState('idle')
        processSpeechQueue()
      }
      window.speechSynthesis.speak(utter)
    }
  }

  async function speak(text: string) {
    cancelSpeech()

    let sentenceBoundary = /[.!?।\n]/
    let tempText = text
    let match
    while ((match = sentenceBoundary.exec(tempText)) !== null) {
      const index = match.index
      const sentence = tempText.slice(0, index + 1).trim()
      tempText = tempText.slice(index + 1)
      if (sentence) {
        queueSpeech(sentence)
      }
    }
    if (tempText.trim()) {
      queueSpeech(tempText.trim())
    }
  }

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    const now = Date.now()
    if (lastSentRef.current && lastSentRef.current.text === trimmed && now - lastSentRef.current.at < 1200) {
      return
    }
    lastSentRef.current = { text: trimmed, at: now }

    cancelSpeech()

    setMessages(m => [...m, { role: 'user', content: trimmed }])
    setInput('')
    setStreaming(true)
    let assistantText = ''
    let speechBuffer = ''
    let hadError = false
    setMessages(m => [...m, { role: 'assistant', content: '' }])

    abortRef.current = new AbortController()

    await streamChatMessage(
      trimmed, conversationId, lang,
      (token) => {
        assistantText += token
        speechBuffer += token

        setMessages(m => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: assistantText }
          return copy
        })

        if (autoSpeak) {
          const sentenceBoundary = /[.!?।\n]/
          let match
          while ((match = sentenceBoundary.exec(speechBuffer)) !== null) {
            const index = match.index
            const sentence = speechBuffer.slice(0, index + 1).trim()
            speechBuffer = speechBuffer.slice(index + 1)
            if (sentence) {
              queueSpeech(sentence)
            }
          }
        }
      },
      (id) => setConversationId(id),
      () => {
        setStreaming(false)
        if (autoSpeak && speechBuffer.trim() && !hadError) {
          queueSpeech(speechBuffer.trim())
        }
      },
      (errMessage) => {
        hadError = true
        setStreaming(false)
        if (!assistantText) {
          setMessages(m => {
            const copy = [...m]
            copy[copy.length - 1] = { role: 'assistant', content: errMessage, error: true }
            return copy
          })
        } else {
          setNotice(errMessage)
        }
      },
      abortRef.current.signal,
    )
  }

  function startListening() {
    cancelSpeech()
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setNotice('Voice input is not supported in this browser. Try Chrome or Edge.'); return }
    try {
      const recog = new SR()
      recog.lang = lang
      recog.continuous = false
      recog.interimResults = false
      recog.onstart = () => setVoiceState('listening')
      recog.onerror = (e: any) => {
        setVoiceState('idle')
        if (e?.error === 'language-not-supported' && lang !== 'en-US') {
          setNotice('Speech recognition does not support this language on your device — falling back to English.')
          setLang('en-US')
        } else if (e?.error === 'no-speech') {
          setNotice("Didn't catch that — please try again.")
        } else {
          setNotice('Speech recognition failed. Please try again or type your question.')
        }
      }
      recog.onend = () => setVoiceState('idle')
      recog.onresult = (e: any) => {
        const text = e.results?.[0]?.[0]?.transcript
        if (text) send(text)
      }
      recognitionRef.current = recog
      recog.start()
    } catch (e) {
      console.error('Speech recognition error:', e)
      setVoiceState('idle')
      setNotice('Could not start voice input. Please try again.')
    }
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setVoiceState('idle')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-violet text-[12.5px] font-semibold uppercase tracking-wide mb-2">Multilingual AI Assistant</div>
          <h1 className="font-display text-2xl font-bold">CyberRakshak Assistant</h1>
        </div>
        <div className="flex items-center gap-2">
          {aiStatusLoaded && !aiProvider && (
            <span className="text-[11.5px] px-3 py-1.5 rounded-full bg-warning/15 text-warning font-medium">Demo Mode — AI provider unavailable</span>
          )}
          {aiProvider && (
            <span className="text-[11.5px] px-3 py-1.5 rounded-full bg-safe/15 text-safe font-medium">● {aiProvider === 'groq' ? 'Groq connected' : 'Ollama connected'}</span>
          )}
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            className="input-field !w-auto !py-2 text-[12.5px]"
            title="Conversation language — used for AI replies, speech input, and speech output"
          >
            {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
          <button onClick={handleToggleAutoSpeak} className="btn btn-ghost text-[12.5px] px-3 py-2" title="Toggle auto voice playback">
            {autoSpeak ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button onClick={() => { setMessages([]); setConversationId(null) }} className="btn btn-ghost text-[12.5px] px-3 py-2"><Plus size={15} /> New Chat</button>
        </div>
      </div>

      {notice && (
        <div className="mb-4 flex items-center gap-2 text-[12.5px] text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="flex-shrink-0" />
          {notice}
        </div>
      )}

      <div ref={bodyRef} className="flex-1 overflow-y-auto glass p-6 flex flex-col gap-4 mb-4">
        {messages.length === 0 && (
          <div className="text-muted text-[14px] text-center my-auto">
            Ask about a suspicious link, an OTP scam, a hacked account, or anything cybersecurity-related — in English or any Indian language.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-[13.5px] ${
            m.role === 'user'
              ? 'bg-teal/15 text-teal self-end rounded-br-sm whitespace-pre-wrap leading-relaxed'
              : m.error
                ? 'bg-danger/10 border border-danger/25 text-danger self-start rounded-bl-sm'
                : 'bg-white/5 border border-border1 self-start rounded-bl-sm'
          }`}>
            {m.role === 'assistant' ? (
              m.content ? (
                <div className="chat-md">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                    {m.content}
                  </ReactMarkdown>
                </div>
              ) : (streaming && i === messages.length - 1 ? <span className="text-muted">…</span> : '')
            ) : m.content}
            {m.role === 'assistant' && m.content && !m.error && (
              <div className="flex gap-2 mt-2">
                <button onClick={() => navigator.clipboard.writeText(m.content)} className="text-muted hover:text-white" title="Copy"><Copy size={12} /></button>
                <button onClick={() => speak(m.content)} className="text-muted hover:text-white" title="Speak"><Volume2 size={12} /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK_PROMPTS.map(p => (
          <button key={p} onClick={() => send(p)} disabled={streaming} className="text-[11.5px] px-3 py-1.5 rounded-full border border-border1 text-muted hover:text-white hover:border-white/20 disabled:opacity-50">{p}</button>
        ))}
      </div>

      <div className="glass flex items-center gap-3 p-3">
        <button
          onClick={voiceState === 'listening' ? stopListening : startListening}
          disabled={streaming}
          className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50 ${
            voiceState === 'listening' ? 'bg-danger animate-pulse' : 'bg-violet'
          }`}
        >
          {voiceState === 'listening' ? <Square size={16} color="#fff" /> : <Mic size={18} color="#fff" />}
        </button>
        <input
          className="input-field flex-1"
          placeholder={voiceState === 'listening' ? 'Listening…' : 'Ask about a link, scam, or hack...'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.repeat) send(input) }}
          disabled={streaming}
        />
        <button onClick={() => send(input)} disabled={streaming || !input.trim()} className="w-11 h-11 rounded-full bg-violet flex items-center justify-center flex-shrink-0 disabled:opacity-50">
          {streaming ? <Check size={16} color="#fff" className="opacity-50" /> : <Send size={16} color="#fff" />}
        </button>
      </div>
      <p className="text-[11px] text-muted mt-2 text-center">
        Voice input/output uses your browser's built-in speech APIs. For best multilingual accuracy, use Chrome or Edge.
      </p>
    </div>
  )
}
