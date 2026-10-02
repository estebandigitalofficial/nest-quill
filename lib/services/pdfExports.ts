// Pure helpers for PDF export identity and currency.
//
// A story that is regenerated (admin force-requeue) completes again with a
// new completed_at. Its earlier export must then be treated as stale: the
// status route stops serving it, generate-pdf renders a replacement under a
// NEW claim key, and the replacement demotes every older export so exactly
// one row is_latest per story.

export interface ExportStamp {
  id: string
  created_at: string
  is_latest?: boolean | null
}

/** One claim per (story, completion). A re-completed story gets a fresh key. */
export function pdfClaimKey(requestId: string, completedAt: string | null | undefined): string {
  const t = completedAt ? Date.parse(completedAt) : NaN
  return Number.isFinite(t) ? `pdf:${requestId}:${t}` : `pdf:${requestId}`
}

/** True when the export was produced for the story's current completion. */
export function exportIsCurrent(exp: Pick<ExportStamp, 'created_at'> | null | undefined, completedAt: string | null | undefined): boolean {
  if (!exp) return false
  const done = completedAt ? Date.parse(completedAt) : NaN
  if (!Number.isFinite(done)) return true
  const made = Date.parse(exp.created_at)
  return Number.isFinite(made) && made >= done
}

/** Ids of the exports to flip to is_latest=false once `keepId` is the canonical one. */
export function idsToDemote(rows: ExportStamp[], keepId: string): string[] {
  return rows.filter(r => r.id !== keepId && r.is_latest !== false).map(r => r.id)
}
