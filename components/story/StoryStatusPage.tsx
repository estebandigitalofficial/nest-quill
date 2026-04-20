'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { StoryStatusResponse, StoryContentResponse } from '@/types/story'

const TERMINAL_STATUSES = ['complete', 'failed']
const POLL_INTERVAL_MS = 3000

export default function StoryStatusPage({ requestId }: { requestId: string }) {
  const [status, setStatus] = useState<StoryStatusResponse | null>(null)
  const [story, setStory] = useState<StoryContentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/story/status?requestId=${requestId}`)
      if (res.status === 404) {
        setError('Story not found. This link may be invalid or has expired.')
        return true // stop polling
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

  useEffect(() => {
    let stopped = false

    async function poll() {
      const done = await fetchStatus()
      if (done || stopped) return
      setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()
    return () => { stopped = true }
  }, [fetchStatus])

  // Fetch story content once complete
  useEffect(() => {
    if (status?.status === 'complete') {
      fetchStory()
    }
  }, [status?.status, fetchStory])

  if (error) return <ErrorView message={error} />

  if (!status) return <LoadingShell />

  if (status.status === 'failed') {
    return (
      <PageShell>
        <div className="text-center space-y-4 py-8">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-serif text-gray-900">Something went wrong</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            We ran into a problem generating this story. Please try again.
          </p>
          <Link
            href="/create"
            className="inline-block mt-2 bg-brand-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-brand-600 transition-colors"
          >
            Try again →
          </Link>
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

  return (
    <PageShell>
      <StoryReader story={story} />
    </PageShell>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="text-sm font-semibold text-brand-500 hover:text-brand-600">
            Nest &amp; Quill
          </Link>
        </div>
        {children}
      </div>
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
    <div className="min-h-screen bg-brand-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 text-center max-w-sm w-full space-y-4">
        <div className="text-4xl">🔍</div>
        <h2 className="text-lg font-serif text-gray-900">Oops</h2>
        <p className="text-sm text-gray-500">{message}</p>
        <Link
          href="/create"
          className="inline-block text-sm font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2"
        >
          Start a new story
        </Link>
      </div>
    </div>
  )
}

function ProcessingView({ status }: { status: StoryStatusResponse }) {
  const pct = Math.max(5, status.progressPct ?? 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 text-center space-y-6">
      <div className="text-5xl animate-pulse">📖</div>

      <div>
        <h2 className="text-2xl font-serif text-gray-900 mb-1">
          {status.childName ? `Creating ${status.childName}'s story…` : 'Creating your story…'}
        </h2>
        <p className="text-sm text-gray-400">This usually takes about a minute.</p>
      </div>

      <div className="space-y-2">
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-brand-500 h-2.5 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400">{status.statusMessage}</p>
      </div>

      <p className="text-xs text-gray-300">
        This page will update automatically — no need to refresh.
      </p>
    </div>
  )
}

function StoryReader({ story }: { story: StoryContentResponse }) {
  return (
    <div className="space-y-6">
      {/* Cover */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 text-center space-y-3">
        <p className="text-xs font-semibold tracking-widest text-brand-400 uppercase">
          {story.authorLine}
        </p>
        <h1 className="text-3xl font-serif text-gray-900 leading-snug">{story.title}</h1>
        {story.subtitle && (
          <p className="text-base text-gray-500 italic">{story.subtitle}</p>
        )}
        {story.dedication && (
          <p className="text-sm text-gray-400 italic border-t border-gray-100 pt-4 mt-4">
            {story.dedication}
          </p>
        )}
      </div>

      {/* Pages */}
      {story.pages.map((page) => (
        <div
          key={page.pageNumber}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-6 space-y-3"
        >
          <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest">
            Page {page.pageNumber}
          </p>
          <p className="text-base text-gray-800 leading-relaxed">{page.text}</p>
          {page.imageStatus === 'pending' && (
            <div className="w-full h-40 bg-brand-50 rounded-xl flex items-center justify-center border border-brand-100">
              <p className="text-xs text-brand-300">Illustration coming soon</p>
            </div>
          )}
        </div>
      ))}

      {/* Footer */}
      <div className="text-center py-4 space-y-3">
        <p className="text-sm text-gray-400 font-serif italic">✦ The End ✦</p>
        <Link
          href="/create"
          className="inline-block text-sm font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2"
        >
          Create another story →
        </Link>
      </div>
    </div>
  )
}
