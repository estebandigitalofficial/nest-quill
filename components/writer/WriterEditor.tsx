'use client'

import { useActionState, useEffect, useState } from 'react'
import { saveWriterProjectAction, type SaveProjectState } from '@/app/writer/actions'

interface Props {
  projectId: string
  initialTitle: string
  initialDraft: string
  typeName: string
  typeIcon: string
  statusLabel: string
  iconBg: string
  chipBg: string
  chipText: string
  outlineItems: string[]
}

const INITIAL_STATE: SaveProjectState = { ok: false }

export default function WriterEditor({
  projectId,
  initialTitle,
  initialDraft,
  typeName,
  typeIcon,
  statusLabel,
  iconBg,
  chipBg,
  chipText,
  outlineItems,
}: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [draft, setDraft] = useState(initialDraft)

  // Baseline = last successfully-saved values. Dirty when current ≠ baseline.
  const [baseline, setBaseline] = useState({ title: initialTitle, draft: initialDraft })
  const dirty = title !== baseline.title || draft !== baseline.draft

  const [state, formAction, pending] = useActionState(saveWriterProjectAction, INITIAL_STATE)

  // On a successful save, adopt the current values as the new baseline so the
  // indicator flips to "saved". (Keep-it-simple: snapshots current values.)
  useEffect(() => {
    if (state.ok && state.savedAt) {
      setBaseline({ title, draft })
    }
    // Only react to a new save result, not to keystrokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt, state.ok])

  return (
    <form action={formAction} className="grid lg:grid-cols-[280px_1fr] gap-6">
      <input type="hidden" name="projectId" value={projectId} />

      {/* ── Left panel ── */}
      <aside className="space-y-5">
        <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-5 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm`}
            >
              {typeIcon}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${chipBg} ${chipText}`}>
                {typeName}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-charcoal-light/10 text-charcoal-light">
                {statusLabel}
              </span>
            </div>
          </div>

          <label htmlFor="title" className="block text-xs font-bold uppercase tracking-wide text-charcoal-light mb-1.5">
            Project title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            className="w-full rounded-xl border border-parchment-dark bg-parchment/40 px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-oxford/30"
          />
        </div>

        {/* Outline placeholder */}
        <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-5 py-5">
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal-light mb-3">Outline</p>
          <ul className="space-y-1.5">
            {outlineItems.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-charcoal-light">
                <span className="w-1.5 h-1.5 rounded-full bg-charcoal-light/30 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-charcoal-light/70 mt-3 italic">
            Structured outline editing is coming soon.
          </p>
        </div>

        {/* Settings placeholder */}
        <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-5 py-5">
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal-light mb-2">Settings</p>
          <p className="text-[11px] text-charcoal-light/70 italic">
            Voice, audience, and formatting options are coming soon.
          </p>
        </div>
      </aside>

      {/* ── Main panel ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label htmlFor="draft" className="text-xs font-bold uppercase tracking-wide text-charcoal-light">
            Draft
          </label>
          <div className="flex items-center gap-3">
            <span aria-live="polite" className="text-xs font-medium">
              {pending ? (
                <span className="text-charcoal-light">Saving…</span>
              ) : state.error ? (
                <span className="text-rose-600">{state.error}</span>
              ) : dirty ? (
                <span className="text-amber-600">Unsaved changes</span>
              ) : (
                <span className="text-emerald-600">All changes saved</span>
              )}
            </span>
            <button
              type="submit"
              disabled={pending || !dirty}
              className="inline-flex justify-center bg-oxford hover:bg-oxford/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-full text-sm transition-all active:scale-[0.98]"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <textarea
          id="draft"
          name="draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Start writing your draft here…"
          className="w-full min-h-[60vh] rounded-2xl border border-parchment-dark bg-white shadow-sm px-5 py-4 text-sm text-charcoal leading-relaxed focus:outline-none focus:ring-2 focus:ring-oxford/30 resize-y"
        />
      </section>
    </form>
  )
}
