import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import type { GuidedTourRow, GuidedTourStepRow } from '@/types/database'
import TourEnableToggle from './TourEnableToggle'

export default async function AdminToursPage() {
  const ctx = await getAdminContext()
  if (!ctx) return null

  const db = createAdminClient()
  const [{ data: tours, error: probeErr }, { data: steps }] = await Promise.all([
    db.from('guided_tours').select('id, tour_key, name, description, enabled, updated_at').order('updated_at', { ascending: false }),
    db.from('guided_tour_steps').select('id, tour_id, step_order, target_selector, title, body, placement, advance_on, advance_selector, wait_message').order('step_order'),
  ])

  // Surface a clear "schema not deployed" message rather than crashing.
  if (probeErr?.code === '42P01') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold text-adm-text">Tours</h1>
        <div className="mt-4 bg-red-500/5 border border-red-500/30 rounded-xl px-4 py-3 text-sm">
          <p className="text-red-300 font-medium">Schema not deployed.</p>
          <p className="text-[11px] text-adm-muted mt-1">
            Apply migration <code className="text-[11px] bg-red-500/10 px-1 py-0.5 rounded">20240051_guided_tours.sql</code> in the Supabase SQL editor.
          </p>
        </div>
      </div>
    )
  }

  const tourRows = (tours ?? []) as unknown as GuidedTourRow[]
  const stepRows = (steps ?? []) as unknown as GuidedTourStepRow[]
  const stepsByTour = new Map<string, GuidedTourStepRow[]>()
  for (const s of stepRows) {
    if (!stepsByTour.has(s.tour_id)) stepsByTour.set(s.tour_id, [])
    stepsByTour.get(s.tour_id)!.push(s)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-adm-text">Guided tours</h1>
        <p className="text-sm text-adm-muted mt-1">Tour definitions are seeded by migration. Toggle a tour off to suppress it across the app.</p>
      </div>

      {tourRows.length === 0 ? (
        <p className="text-sm text-adm-subtle">No tours yet.</p>
      ) : (
        <div className="space-y-4">
          {tourRows.map(t => (
            <div key={t.id} className="bg-adm-surface rounded-2xl border border-adm-border overflow-hidden">
              <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-adm-border">
                <div className="min-w-0">
                  <p className="text-xs text-adm-subtle font-mono">{t.tour_key}</p>
                  <p className="text-base font-semibold text-adm-text mt-0.5">{(t as { name?: string }).name ?? '—'}</p>
                  {t.description && <p className="text-xs text-adm-muted mt-1">{t.description}</p>}
                </div>
                <TourEnableToggle tourId={t.id} initialEnabled={t.enabled} />
              </div>
              <ol className="divide-y divide-adm-border">
                {(stepsByTour.get(t.id) ?? []).map(s => (
                  <li key={s.id} className="px-5 py-3 flex items-start gap-3">
                    <span className="text-[10px] font-mono text-adm-subtle w-6 shrink-0 mt-1">#{s.step_order}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-adm-text">{s.title}</p>
                      <p className="text-[11px] text-adm-muted leading-relaxed mt-0.5">{s.body}</p>
                      {s.target_selector && (
                        <p className="text-[10px] font-mono text-adm-subtle mt-1">target: {s.target_selector}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        <span className="text-[10px] text-adm-subtle">
                          advance: <span className="font-mono">{s.advance_on}</span>
                        </span>
                        {s.advance_selector && (
                          <span className="text-[10px] text-adm-subtle">
                            on: <span className="font-mono">{s.advance_selector}</span>
                          </span>
                        )}
                        {s.wait_message && (
                          <span className="text-[10px] text-adm-subtle italic">&ldquo;{s.wait_message}&rdquo;</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-adm-subtle shrink-0">{s.placement}</span>
                  </li>
                ))}
                {(stepsByTour.get(t.id) ?? []).length === 0 && (
                  <li className="px-5 py-3 text-xs text-adm-subtle">No steps.</li>
                )}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
