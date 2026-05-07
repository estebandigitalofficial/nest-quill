'use client'

// Admin-only recovery action cluster shown on the story detail page.
// Wraps the existing retry / force-requeue / generate-images endpoints
// plus the new cancel / mark-failed routes. Each button confirms
// before mutating, surfaces a quick inline result, and refreshes the
// page so the timeline picks up the new processing_logs entry.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type ActionKey = 'retry' | 'force_requeue' | 'generate_images' | 'cancel' | 'mark_failed'

interface ActionDef {
  key: ActionKey
  label: string
  hint: string
  endpoint: (id: string) => string
  /** Tone drives the button color. */
  tone: 'neutral' | 'sky' | 'amber' | 'rose'
  /** When true the button is hidden unless retryable === true on the row. */
  retryableOnly?: boolean
  /** When true the button is hidden unless status is in this list. */
  statuses?: string[]
}

const ACTIONS: ActionDef[] = [
  {
    key: 'retry',
    label: 'Retry',
    hint: 'Re-queue with retry_count++',
    endpoint: (id) => `/api/story/${id}/retry`,
    tone: 'sky',
    retryableOnly: true,
    statuses: ['failed'],
  },
  {
    key: 'force_requeue',
    label: 'Force requeue',
    hint: 'Release worker, restart pipeline',
    endpoint: (id) => `/api/story/${id}/force-requeue`,
    tone: 'amber',
    statuses: ['failed', 'queued', 'generating_text', 'generating_images', 'assembling_pdf'],
  },
  {
    key: 'generate_images',
    label: 'Retry images only',
    hint: 'Reuse text, generate illustrations',
    endpoint: (id) => `/api/admin/stories/${id}/generate-images`,
    tone: 'neutral',
    statuses: ['complete', 'failed'],
  },
  {
    key: 'cancel',
    label: 'Cancel',
    hint: 'Stop the run, mark not-retryable',
    endpoint: (id) => `/api/admin/stories/${id}/cancel`,
    tone: 'rose',
    statuses: ['queued', 'generating_text', 'generating_images', 'assembling_pdf'],
  },
  {
    key: 'mark_failed',
    label: 'Mark permanently failed',
    hint: 'No further retries',
    endpoint: (id) => `/api/admin/stories/${id}/mark-failed`,
    tone: 'rose',
    statuses: ['failed'],
  },
]

const TONE: Record<ActionDef['tone'], string> = {
  neutral: 'bg-adm-bg hover:bg-adm-surface border border-adm-border text-adm-text',
  sky:     'bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300',
  amber:   'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300',
  rose:    'bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300',
}

export default function AdminRecoveryActions({
  requestId,
  status,
  retryable,
}: {
  requestId: string
  status: string
  retryable: boolean | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<ActionKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function run(action: ActionDef) {
    if (!confirm(`${action.label} — ${action.hint}. Continue?`)) return
    setBusy(action.key)
    setError(null)
    try {
      const res = await fetch(action.endpoint(requestId), { method: 'POST' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.message ?? json.error ?? `HTTP ${res.status}`)
      } else {
        startTransition(() => router.refresh())
      }
    } catch {
      setError("Couldn't reach the server.")
    } finally {
      setBusy(null)
    }
  }

  const visible = ACTIONS.filter(a => {
    if (a.retryableOnly && retryable !== true) return false
    if (a.statuses && !a.statuses.includes(status)) return false
    return true
  })

  if (visible.length === 0) {
    return <p className="text-xs text-adm-subtle">No recovery actions available for status &quot;{status}&quot;.</p>
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {visible.map(a => (
          <button
            key={a.key}
            type="button"
            onClick={() => run(a)}
            disabled={busy !== null}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 ${TONE[a.tone]}`}
          >
            {busy === a.key ? 'Working…' : a.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-rose-300 mt-2">{error}</p>}
    </div>
  )
}
