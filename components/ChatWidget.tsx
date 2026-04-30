'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const GREETING: Message = {
  role: 'assistant',
  content: "Hi! I'm the Nest & Quill assistant. I can help you brainstorm the perfect story for your child, or answer any questions about how the service works. What would you like to know?",
}


export default function ChatWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })

      if (!res.ok || !res.body) throw new Error('Chat failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let reply = ''

      setLoading(false)
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        reply += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: reply }
          return updated
        })
      }
    } catch {
      setLoading(false)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    }
  }, [input, loading, messages])

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // Hide on admin pages — checked after all hooks
  if (pathname?.startsWith('/admin')) return null

  return (
    <>
      {/* Panel */}
      {open && (
        <div className="bottom-28 sm:bottom-[84px]" style={{
          position: 'fixed', right: 20, zIndex: 50,
          width: 360, maxWidth: 'calc(100vw - 32px)',
          background: '#F8F5EC',
          borderRadius: 20,
          boxShadow: '0 12px 48px rgba(12,35,64,0.2)',
          border: '1px solid rgba(12,35,64,0.1)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ background: '#0C2340', padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#F8F5EC', fontFamily: '"Playfair Display", Georgia, serif', letterSpacing: '-0.2px' }}>
                Nest &amp; Quill Assistant
              </p>
              <p style={{ margin: '1px 0 0', fontSize: 11, color: 'rgba(248,245,236,0.55)' }}>
                Story ideas &amp; product help
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(248,245,236,0.6)', padding: 4, display: 'flex', lineHeight: 0 }}
              aria-label="Close chat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, minHeight: 120 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '9px 13px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? '#0C2340' : '#fff',
                  color: msg.role === 'user' ? '#F8F5EC' : '#2E2E2E',
                  fontSize: 13,
                  lineHeight: 1.6,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  border: msg.role === 'assistant' ? '1px solid rgba(12,35,64,0.07)' : 'none',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content || <span style={{ opacity: 0.3, fontSize: 18, letterSpacing: 3 }}>•••</span>}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  background: '#fff', borderRadius: '16px 16px 16px 4px',
                  padding: '10px 16px', border: '1px solid rgba(12,35,64,0.07)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  <span style={{ fontSize: 18, letterSpacing: 4, color: '#C99700', opacity: 0.7 }}>•••</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 10px 10px',
            background: '#fff',
            borderTop: '1px solid rgba(12,35,64,0.07)',
            display: 'flex', gap: 6, alignItems: 'center',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything…"
              disabled={loading}
              style={{
                flex: 1, fontSize: 13, padding: '9px 12px',
                borderRadius: 10, border: '1px solid rgba(12,35,64,0.15)',
                background: '#F8F5EC', outline: 'none',
                color: '#2E2E2E', fontFamily: 'inherit',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                background: '#C99700', border: 'none',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                opacity: input.trim() && !loading ? 1 : 0.35,
                borderRadius: 10, padding: '9px 11px',
                color: '#fff', display: 'flex', alignItems: 'center', lineHeight: 0,
                transition: 'opacity 0.15s',
                flexShrink: 0,
              }}
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="bottom-8 right-3 sm:bottom-[68px] sm:right-5 ls:bottom-14"
        style={{
          position: 'fixed', zIndex: 50,
          width: 120, height: 120,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.55)) drop-shadow(0 4px 16px rgba(0,0,0,0.3))',
          transition: 'transform 0.2s',
          lineHeight: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.07)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
        aria-label={open ? 'Close chat' : 'Chat with us'}
      >
        {open ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0C2340" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="https://nestandquill.b-cdn.net/Nest%20and%20Quill%20favicon.webp"
            alt="Nest & Quill"
            width={120}
            height={120}
            style={{ objectFit: 'contain' }}
          />
        )}
      </button>
    </>
  )
}
