'use client'

// Renders the initial server-prepared rows and owns the "Load older stories"
// button. State stays local: each click appends a fresh page from
// /api/account/stories, dedupes by id, and stops when nextCursor is null.

import { useState } from 'react'
import StoryRow from './StoryRow'

interface Story {
  id: string
  child_name: string
  story_theme: string
  status: string
  created_at: string
  archived_at?: string | null
}

interface RowEntry {
  story: Story
  thumbUrl: string | null
}

interface Props {
  initialRows: RowEntry[]
  initialNextCursor: string | null
  /** archive on the active list, restore on the archived list */
  mode: 'archive' | 'restore'
  /** which API list to paginate */
  archivedView: boolean
}

export default function StoryList({ initialRows, initialNextCursor, mode, archivedView }: Props) {
  const [rows, setRows] = useState<RowEntry[]>(initialRows)
  const [cursor, setCursor] = useState<string | null>(initialNextCursor)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    params.set('archived', archivedView ? 'true' : 'false')
    params.set('cursor', cursor)
    const res = await fetch(`/api/account/stories?${params.toString()}`)
    setLoading(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.message ?? 'Could not load older stories.')
      return
    }
    const data = (await res.json()) as { rows: RowEntry[]; nextCursor: string | null }
    setRows(prev => {
      // De-dupe in case a row showed up in both pages (e.g. status flipped
      // between requests). Keys by id; later entries win.
      const seen = new Map<string, RowEntry>()
      for (const r of prev) seen.set(r.story.id, r)
      for (const r of data.rows) seen.set(r.story.id, r)
      return Array.from(seen.values())
    })
    setCursor(data.nextCursor)
  }

  return (
    <div className="space-y-3">
      {rows.map(({ story, thumbUrl }) => (
        <StoryRow
          key={story.id}
          story={story}
          thumbUrl={thumbUrl ?? undefined}
          mode={mode}
        />
      ))}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-2 text-center">{error}</p>
      )}

      {cursor ? (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="text-sm font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 transition-colors px-4 py-2 rounded-lg border border-gray-200 hover:border-brand-300 bg-white">
            {loading ? 'Loading…' : 'Load older stories'}
          </button>
        </div>
      ) : (
        rows.length > 0 && (
          <p className="text-center text-xs text-gray-400 pt-2">You&apos;ve reached the end.</p>
        )
      )}
    </div>
  )
}
