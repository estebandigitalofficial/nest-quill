'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import type { StoryStatusResponse, StoryContentResponse, StoryContentPage, StoryQuizResponse } from '@/types/story'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

const TERMINAL_STATUSES = ['complete', 'failed']
const POLL_INTERVAL_MS = 3000
const TRANSITION_MS = 280

export default function StoryStatusPage({ requestId, isAdmin }: { requestId: string; isAdmin?: boolean }) {
  const [status, setStatus] = useState<StoryStatusResponse | null>(null)
  const [story, setStory] = useState<StoryContentResponse | null>(null)
  const [quiz, setQuiz] = useState<StoryQuizResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pollKey, setPollKey] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/story/status?requestId=${requestId}`)
      if (res.status === 404) {
        setError('Story not found. This link may be invalid or has expired.')
        return true
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.message ?? 'Failed to load status.')
        return true
      }
      const data: StoryStatusResponse = await res.json()
      setStatus(data)
      return TERMINAL_STATUSES.includes(data.status)
    } catch {
      setError('Could not reach the server.')
      return true
    }
  }, [requestId])

  const fetchStory = useCallback(async () => {
    const res = await fetch(`/api/story/${requestId}`)
    if (!res.ok) return
    const data: StoryContentResponse = await res.json()
    setStory(data)
  }, [requestId])

  const fetchQuiz = useCallback(async () => {
    const res = await fetch(`/api/story/${requestId}/quiz`)
    if (!res.ok) return
    const data: StoryQuizResponse = await res.json()
    setQuiz(data)
  }, [requestId])

  useEffect(() => {
    let stopped = false
    async function poll() {
      const done = await fetchStatus()
      if (done || stopped) return
      setTimeout(poll, POLL_INTERVAL_MS)
    }
    poll()
    return () => { stopped = true }
  }, [fetchStatus, pollKey])

  useEffect(() => {
    if (status?.status === 'complete') {
      fetchStory()
      if (status.learningMode) fetchQuiz()
    }
  }, [status?.status, status?.learningMode, fetchStory, fetchQuiz])

  async function handleRetry() {
    setRetrying(true)
    setRetryError(null)
    const res = await fetch(`/api/story/${requestId}/retry`, { method: 'POST' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setRetryError(json.message ?? 'Could not retry. Please try again.')
      setRetrying(false)
      return
    }
    setStatus(null)
    setPollKey(k => k + 1)
    setRetrying(false)
  }

  if (error) return <ErrorView message={error} />
  if (!status) return <LoadingShell />

  if (status.status === 'failed') {
    return (
      <PageShell>
        <div className="text-center space-y-4 py-8">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-serif text-gray-900">Something went wrong</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            We ran into a problem generating this story.
          </p>
          {retryError && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-2 max-w-sm mx-auto">{retryError}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              {retrying ? 'Retrying…' : 'Retry this story'}
            </button>
            <Link href="/create" className="bg-white border border-gray-200 text-gray-700 hover:border-gray-300 text-sm font-semibold px-6 py-3 rounded-xl transition-colors">
              Start a new story
            </Link>
          </div>
        </div>
      </PageShell>
    )
  }

  if (status.status !== 'complete' || !story) {
    return (
      <PageShell>
        <ProcessingView status={status} />
      </PageShell>
    )
  }

  return <StoryEbookReader story={story} requestId={requestId} pdfUrl={status.signedUrl} planTier={status.planTier} isAdmin={isAdmin} quiz={quiz} />
}

// ── Non-reader shells ─────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-2xl mx-auto">
          {children}
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}

function LoadingShell() {
  return (
    <PageShell>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-12 text-center">
        <div className="w-8 h-8 border-2 border-brand-300 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-400">Loading your story…</p>
      </div>
    </PageShell>
  )
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader />
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-8 py-10 text-center max-w-sm w-full space-y-4">
          <div className="text-4xl">🔍</div>
          <h2 className="text-lg font-serif text-oxford">Oops</h2>
          <p className="text-sm text-charcoal-light">{message}</p>
          <Link href="/create" className="inline-block text-sm font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2">
            Start a new story
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}

function ProcessingView({ status }: { status: StoryStatusResponse }) {
  const pct = Math.max(5, status.progressPct ?? 0)
  return (
    <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-8 py-10 text-center space-y-6">
      <div className="text-5xl animate-pulse">📖</div>
      <div>
        <h2 className="text-2xl font-serif text-oxford mb-1">
          {status.childName ? `Creating ${status.childName}'s story…` : 'Creating your story…'}
        </h2>
        <p className="text-sm text-charcoal-light">This usually takes about a minute.</p>
      </div>
      <div className="space-y-2">
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div className="bg-brand-500 h-2.5 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-400">{status.statusMessage}</p>
      </div>
      <p className="text-xs text-gray-300">This page will update automatically — no need to refresh.</p>
    </div>
  )
}

// ── Ebook reader ──────────────────────────────────────────────────────────────

type ReaderPage =
  | { kind: 'cover' }
  | { kind: 'story'; page: StoryContentPage }
  | { kind: 'end' }
  | { kind: 'quiz' }

function StoryEbookReader({ story, requestId, pdfUrl, planTier, isAdmin, quiz }: { story: StoryContentResponse; requestId: string; pdfUrl?: string; planTier?: string; isAdmin?: boolean; quiz?: StoryQuizResponse | null }) {
  const canDownload = planTier !== 'free'
  const backHref = isAdmin ? '/admin' : '/account'
  const backLabel = isAdmin ? 'Admin dashboard' : 'My stories'
  const readerPages: ReaderPage[] = [
    { kind: 'cover' },
    ...story.pages.map(p => ({ kind: 'story' as const, page: p })),
    { kind: 'end' },
    ...(quiz ? [{ kind: 'quiz' as const }] : []),
  ]

  const storageKey = `story-pos-${requestId}`
  const navRef = useRef({ next: () => {}, prev: () => {} })
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)

  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)
  const [uiVisible, setUiVisible] = useState(true)

  // Restore position
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const saved = parseInt(localStorage.getItem(storageKey) ?? '0', 10)
    if (!isNaN(saved) && saved > 0 && saved < readerPages.length) setCurrent(saved)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem(storageKey, String(current))
  }, [current, storageKey])

  function bumpUi() {
    setUiVisible(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setUiVisible(false), 3500)
  }

  useEffect(() => {
    bumpUi()
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [])

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  function go(to: number) {
    if (to < 0 || to >= readerPages.length || animating) return
    setSlideDir(to > current ? 'left' : 'right')
    setAnimating(true)
    setTimeout(() => {
      setCurrent(to)
      setSlideDir(null)
      setAnimating(false)
    }, TRANSITION_MS)
    bumpUi()
  }

  useEffect(() => {
    navRef.current = {
      next: () => go(current + 1),
      prev: () => go(current - 1),
    }
  })

  // Window-level swipe
  useEffect(() => {
    let startX = 0, startY = 0
    function onStart(e: TouchEvent) { startX = e.touches[0].clientX; startY = e.touches[0].clientY; bumpUi() }
    function onEnd(e: TouchEvent) {
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        dx < 0 ? navRef.current.next() : navRef.current.prev()
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [])

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navRef.current.next()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navRef.current.prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const page = readerPages[current]
  const progress = readerPages.length > 1 ? current / (readerPages.length - 1) : 0

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#F8F5EC', overflow: 'hidden' }}
      onClick={bumpUi}
    >
      {/* Header — back link */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        opacity: uiVisible ? 1 : 0,
        pointerEvents: uiVisible ? 'auto' : 'none',
        transition: 'opacity 0.4s',
      }}>
        <div style={{ height: 40, background: 'linear-gradient(to bottom, #F8F5EC, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 16 }}>
          <Link
            href={backHref}
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 11, color: '#a8a29e', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            {backLabel}
          </Link>
          {pdfUrl && canDownload && (
            <a
              href={pdfUrl}
              download
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 11, color: '#C99700', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download PDF
            </a>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#ede8e1', zIndex: 10 }}>
        <div style={{ height: '100%', background: '#C99700', width: `${progress * 100}%`, transition: 'width 0.4s' }} />
      </div>

      {/* Tap zones */}
      <button
        aria-hidden tabIndex={-1}
        onClick={e => { e.stopPropagation(); go(current - 1) }}
        disabled={current === 0 || animating}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '38%', zIndex: 10, background: 'transparent', border: 'none', cursor: current === 0 ? 'default' : 'w-resize' }}
      />
      <button
        aria-hidden tabIndex={-1}
        onClick={e => { e.stopPropagation(); go(current + 1) }}
        disabled={current === readerPages.length - 1 || animating}
        style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '38%', zIndex: 10, background: 'transparent', border: 'none', cursor: current === readerPages.length - 1 ? 'default' : 'e-resize' }}
      />

      {/* Arrows */}
      <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 20, pointerEvents: 'none', opacity: uiVisible && current > 0 ? 0.35 : 0, transition: 'opacity 0.3s' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </div>
      <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 20, pointerEvents: 'none', opacity: uiVisible && current < readerPages.length - 1 ? 0.35 : 0, transition: 'opacity 0.3s' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>

      {/* Page content */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingBottom: 72,
        opacity: animating ? 0 : 1,
        transform: animating ? `translateX(${slideDir === 'left' ? -24 : 24}px)` : 'translateX(0)',
        transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
      }}>
        <div style={{ width: '100%', maxWidth: 480, padding: '0 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          {page.kind === 'cover' && <CoverPage story={story} hasMore={readerPages.length > 1} />}
          {page.kind === 'story' && <StoryPageContent page={page.page} storyIndex={current} total={story.pages.length} />}
          {page.kind === 'end' && <EndPage pdfUrl={pdfUrl} canDownload={canDownload} backHref={backHref} hasQuiz={!!quiz} onTakeQuiz={() => go(readerPages.length - 1)} />}
          {page.kind === 'quiz' && quiz && <QuizPage quiz={quiz} requestId={requestId} />}
        </div>
      </div>

      {/* Nav bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        opacity: uiVisible ? 1 : 0,
        transform: uiVisible ? 'translateY(0)' : 'translateY(8px)',
        pointerEvents: uiVisible ? 'auto' : 'none',
        transition: 'opacity 0.4s, transform 0.4s',
      }}>
        <div style={{ height: 20, background: 'linear-gradient(to top, #F8F5EC, transparent)' }} />
        <div style={{ background: '#F8F5EC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 20px', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => go(0)} disabled={current === 0 || animating}
              style={{ fontSize: 11, fontWeight: 500, padding: '8px 12px', borderRadius: 8, border: '1px solid #e7e5e4', color: current === 0 ? '#d6d3d1' : '#78716c', background: 'transparent', cursor: current === 0 ? 'default' : 'pointer', transition: 'color 0.2s' }}
            >
              ↩ Start
            </button>
            <button
              onClick={() => go(current - 1)} disabled={current === 0 || animating}
              style={{ fontSize: 11, fontWeight: 500, padding: '8px 12px', borderRadius: 8, border: '1px solid #e7e5e4', color: current === 0 ? '#d6d3d1' : '#78716c', background: 'transparent', cursor: current === 0 ? 'default' : 'pointer', transition: 'color 0.2s' }}
            >
              ← Prev
            </button>
          </div>
          <span style={{ fontSize: 10, color: '#a8a29e', letterSpacing: '0.05em' }}>
            {current + 1} / {readerPages.length}
          </span>
          <button
            onClick={() => go(current + 1)} disabled={current === readerPages.length - 1 || animating}
            style={{ fontSize: 11, fontWeight: 500, padding: '8px 16px', borderRadius: 8, border: '1px solid #e7e5e4', color: current === readerPages.length - 1 ? '#d6d3d1' : '#78716c', background: 'transparent', cursor: current === readerPages.length - 1 ? 'default' : 'pointer', transition: 'color 0.2s' }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

function CoverPage({ story, hasMore }: { story: StoryContentResponse; hasMore: boolean }) {
  return (
    <div style={{ textAlign: 'center', width: '100%' }}>
      <p style={{ fontSize: 10, color: '#a8a29e', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
        {story.authorLine}
      </p>
      <h1 style={{ fontFamily: 'Georgia,"Times New Roman",serif', fontSize: 'clamp(1.8rem,6vw,2.6rem)', color: '#0C2340', lineHeight: 1.2, marginBottom: 12 }}>
        {story.title}
      </h1>
      {story.subtitle && (
        <p style={{ fontFamily: 'Georgia,"Times New Roman",serif', fontStyle: 'italic', color: '#78716c', fontSize: '1rem', marginBottom: 16 }}>
          {story.subtitle}
        </p>
      )}
      {story.dedication && (
        <p style={{ fontSize: '0.8rem', color: '#a8a29e', fontStyle: 'italic', borderTop: '1px solid #e7e5e4', paddingTop: 16, marginTop: 16 }}>
          {story.dedication}
        </p>
      )}
      {hasMore && (
        <p style={{ fontSize: 11, color: '#c4b5a0', marginTop: 40 }}>Tap or swipe to begin →</p>
      )}
    </div>
  )
}

function StoryPageContent({ page, storyIndex, total }: { page: StoryContentPage; storyIndex: number; total: number }) {
  return (
    <>
      <p style={{ fontSize: 10, color: '#c4b5a0', letterSpacing: '0.1em', alignSelf: 'center' }}>
        {storyIndex} / {total}
      </p>

      {page.imageUrl ? (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={page.imageUrl}
            alt={`Illustration for page ${page.pageNumber}`}
            style={{ maxHeight: '42vh', maxWidth: '100%', objectFit: 'contain', borderRadius: 14, display: 'block' }}
          />
        </div>
      ) : (
        <div style={{ width: '100%', height: '36vh', background: '#f0ece6', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 11, color: '#c4b5a0' }}>
            {page.imageStatus === 'pending' ? 'Illustration coming soon' : ''}
          </p>
        </div>
      )}

      <p style={{ fontFamily: 'Georgia,"Times New Roman",serif', fontSize: 'clamp(1rem,3.5vw,1.125rem)', lineHeight: 1.85, color: '#2E2E2E', textAlign: 'center', width: '100%' }}>
        {page.text}
      </p>
    </>
  )
}

function EndPage({ pdfUrl, canDownload, backHref, hasQuiz, onTakeQuiz }: { pdfUrl?: string; canDownload: boolean; backHref: string; hasQuiz?: boolean; onTakeQuiz?: () => void }) {
  return (
    <div style={{ textAlign: 'center', width: '100%' }}>
      <p style={{ fontFamily: 'Georgia,"Times New Roman",serif', fontSize: '1.6rem', color: '#a8a29e', marginBottom: 36 }}>
        ✦ The End ✦
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        {hasQuiz && (
          <button
            onClick={onTakeQuiz}
            style={{ fontSize: 13, fontWeight: 600, color: 'white', background: '#4f46e5', padding: '10px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            🎓 Take the quiz →
          </button>
        )}
        {pdfUrl && canDownload && (
          <a
            href={pdfUrl}
            download
            style={{ fontSize: 13, fontWeight: 600, color: 'white', background: '#C99700', padding: '10px 24px', borderRadius: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download PDF
          </a>
        )}
        {!canDownload && (
          <Link
            href="/pricing"
            style={{ fontSize: 13, fontWeight: 600, color: '#C99700', background: '#fff8f0', border: '1.5px solid #f5d9b0', padding: '10px 24px', borderRadius: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            🔒 Upgrade to download PDF
          </Link>
        )}
        <Link
          href={backHref}
          style={{ fontSize: 13, fontWeight: 600, color: 'white', background: (pdfUrl && canDownload) ? '#78716c' : hasQuiz ? '#78716c' : '#C99700', padding: '10px 24px', borderRadius: 12, textDecoration: 'none', display: 'inline-block' }}
        >
          {backHref === '/admin' ? 'Back to dashboard →' : 'View in my account →'}
        </Link>
        <Link
          href="/create"
          style={{ fontSize: 13, color: '#a8a29e', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Create another story
        </Link>
      </div>
    </div>
  )
}

function QuizPage({ quiz, requestId }: { quiz: StoryQuizResponse; requestId: string }) {
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState<(number | null)[]>(Array(quiz.questions.length).fill(null))
  const [submitted, setSubmitted] = useState(false)
  const [feedback, setFeedback] = useState<{ correct_index: number; explanation: string }[] | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const q = quiz.questions[currentQ]
  const totalQ = quiz.questions.length
  const allAnswered = selected.every(s => s !== null)

  async function handleSubmit() {
    setSubmitting(true)
    const answers = selected.map((s, i) => ({ question_index: i, selected_index: s ?? 0 }))
    const res = await fetch(`/api/story/${requestId}/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: quiz.quizId, answers }),
    })
    if (res.ok) {
      const data = await res.json()
      setScore(data.score)
      setFeedback(data.feedback)
    }
    setSubmitted(true)
    setSubmitting(false)
    setCurrentQ(0)
  }

  if (submitted && feedback !== null && score !== null) {
    return (
      <div style={{ width: '100%', maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <p style={{ fontSize: '2.2rem', marginBottom: 8 }}>
            {score === totalQ ? '🏆' : score >= totalQ * 0.6 ? '⭐' : '📚'}
          </p>
          <p style={{ fontFamily: 'Georgia,"Times New Roman",serif', fontSize: '1.3rem', color: '#0C2340', fontWeight: 700 }}>
            {score} / {totalQ} correct
          </p>
          <p style={{ fontSize: 13, color: '#78716c', marginTop: 4 }}>
            {score === totalQ ? 'Perfect score! Amazing work!' : score >= totalQ * 0.8 ? 'Great job!' : score >= totalQ * 0.6 ? 'Nice effort!' : 'Keep reading and try again!'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {quiz.questions.map((q, i) => {
            const isCorrect = selected[i] === feedback[i].correct_index
            return (
              <div key={i} style={{ background: isCorrect ? '#f0fdf4' : '#fff7f7', border: `1.5px solid ${isCorrect ? '#86efac' : '#fca5a5'}`, borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{i + 1}. {q.question}</p>
                <p style={{ fontSize: 11, color: isCorrect ? '#16a34a' : '#dc2626', marginBottom: 4 }}>
                  {isCorrect ? '✓ Correct' : `✗ You chose: ${q.options[selected[i] ?? 0]}`}
                </p>
                {!isCorrect && (
                  <p style={{ fontSize: 11, color: '#16a34a' }}>Correct: {q.options[feedback[i].correct_index]}</p>
                )}
                <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>{feedback[i].explanation}</p>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: '#a8a29e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          Quiz · {quiz.topic}
        </p>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {quiz.questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              style={{
                width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: i === currentQ ? '#4f46e5' : selected[i] !== null ? '#a5b4fc' : '#e5e7eb',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 18px', marginBottom: 14 }}>
        <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>Question {currentQ + 1} of {totalQ}</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', lineHeight: 1.5 }}>{q.question}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {q.options.map((opt, i) => {
          const isSelected = selected[currentQ] === i
          return (
            <button
              key={i}
              onClick={() => {
                const next = [...selected]
                next[currentQ] = i
                setSelected(next)
              }}
              style={{
                textAlign: 'left', padding: '10px 14px', borderRadius: 10, fontSize: 13,
                border: `1.5px solid ${isSelected ? '#4f46e5' : '#e5e7eb'}`,
                background: isSelected ? '#eef2ff' : '#fff',
                color: isSelected ? '#3730a3' : '#374151',
                cursor: 'pointer', fontWeight: isSelected ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ marginRight: 8, opacity: 0.5 }}>{['A', 'B', 'C', 'D'][i]}.</span>
              {opt}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {currentQ > 0 && (
          <button
            onClick={() => setCurrentQ(q => q - 1)}
            style={{ fontSize: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer' }}
          >
            ← Back
          </button>
        )}
        {currentQ < totalQ - 1 ? (
          <button
            onClick={() => setCurrentQ(q => q + 1)}
            disabled={selected[currentQ] === null}
            style={{ fontSize: 12, padding: '8px 16px', borderRadius: 8, border: 'none', background: selected[currentQ] !== null ? '#4f46e5' : '#e5e7eb', color: selected[currentQ] !== null ? '#fff' : '#9ca3af', cursor: selected[currentQ] !== null ? 'pointer' : 'default', fontWeight: 600 }}
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            style={{ fontSize: 12, padding: '8px 20px', borderRadius: 8, border: 'none', background: allAnswered ? '#4f46e5' : '#e5e7eb', color: allAnswered ? '#fff' : '#9ca3af', cursor: allAnswered ? 'pointer' : 'default', fontWeight: 600 }}
          >
            {submitting ? 'Submitting…' : 'Submit Quiz →'}
          </button>
        )}
      </div>
    </div>
  )
}
