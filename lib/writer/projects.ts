// ──────────────────────────────────────────────────────────────────────────
// Writer Studio — server-side data-access helpers for writer_projects.
//
// Customer-facing companion to Admin Writer (which is untouched). Every helper
// uses the RLS-aware Supabase server client (cookie-bound session) and scopes
// reads/writes by user_id, so a user can only ever touch their own projects.
// The service-role client is deliberately NOT used here — these are normal
// user actions and must stay behind RLS.
//
// Import only from Server Components, Route Handlers, or Server Actions.
// Foundation only: no AI generation, no source-document upload.
// ──────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import type { Json, WriterProjectRow } from '@/types/database'
import type {
  WriterProject,
  WriterProjectDocumentType,
  WriterProjectStatus,
} from '@/types/writer'
import { PROJECT_TYPES } from '@/lib/writer/projectTypes'

// Canonical sets used for validation. Document types come from the single-source
// catalog; statuses mirror the writer_projects CHECK constraint.
const DOCUMENT_TYPES = new Set<string>(PROJECT_TYPES.map((t) => t.id))
const STATUSES = new Set<WriterProjectStatus>(['draft', 'in_progress', 'complete', 'archived'])

export function isWriterDocumentType(value: string): value is WriterProjectDocumentType {
  return DOCUMENT_TYPES.has(value)
}

export function isWriterProjectStatus(value: string): value is WriterProjectStatus {
  return STATUSES.has(value as WriterProjectStatus)
}

// Map a raw DB row (jsonb typed as Json) to the app-facing WriterProject.
function toWriterProject(row: WriterProjectRow): WriterProject {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    document_type: row.document_type as WriterProjectDocumentType,
    status: row.status as WriterProjectStatus,
    outline: Array.isArray(row.outline) ? (row.outline as unknown[]) : [],
    content: isRecord(row.content) ? (row.content as Record<string, unknown>) : {},
    settings: isRecord(row.settings) ? (row.settings as Record<string, unknown>) : {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ── Create ────────────────────────────────────────────────────────────────

export async function createWriterProject({
  userId,
  title,
  documentType,
}: {
  userId: string
  title: string
  documentType: string
}): Promise<WriterProject> {
  if (!userId) throw new Error('createWriterProject: userId is required')
  if (!isWriterDocumentType(documentType)) {
    throw new Error(`createWriterProject: invalid document type "${documentType}"`)
  }

  const cleanTitle = title?.trim() || 'Untitled project'

  // Construct against WriterProjectRow for real type-safety, then cast at the
  // call boundary: supabase-js v2.49 collapses insert/update value params to
  // `never` against this project's hand-written Database type, so the payload
  // must be cast through. Construction above keeps the fields honest.
  const payload: Partial<WriterProjectRow> = {
    user_id: userId,
    title: cleanTitle,
    document_type: documentType,
    status: 'draft',
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('writer_projects')
    .insert(payload as never)
    .select('*')
    .single()

  if (error) throw new Error(`createWriterProject: ${error.message}`)
  return toWriterProject(data as WriterProjectRow)
}

// ── Read ──────────────────────────────────────────────────────────────────

export async function listMyWriterProjects(userId: string): Promise<WriterProject[]> {
  if (!userId) throw new Error('listMyWriterProjects: userId is required')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('writer_projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`listMyWriterProjects: ${error.message}`)
  return (data as WriterProjectRow[]).map(toWriterProject)
}

export async function getWriterProject({
  userId,
  projectId,
}: {
  userId: string
  projectId: string
}): Promise<WriterProject | null> {
  if (!userId) throw new Error('getWriterProject: userId is required')
  if (!projectId) throw new Error('getWriterProject: projectId is required')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('writer_projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`getWriterProject: ${error.message}`)
  return data ? toWriterProject(data as WriterProjectRow) : null
}

// ── Update (each scoped by id + user_id) ────────────────────────────────────

export async function updateWriterProjectTitle({
  userId,
  projectId,
  title,
}: {
  userId: string
  projectId: string
  title: string
}): Promise<WriterProject> {
  const clean = title?.trim()
  if (!clean) throw new Error('updateWriterProjectTitle: title is required')
  // DB enforces 1–200 chars; clamp defensively to avoid a check violation.
  return updateProjectField(userId, projectId, { title: clean.slice(0, 200) })
}

export async function updateWriterProjectOutline({
  userId,
  projectId,
  outline,
}: {
  userId: string
  projectId: string
  outline: unknown[]
}): Promise<WriterProject> {
  return updateProjectField(userId, projectId, { outline: outline as unknown as Json })
}

export async function updateWriterProjectContent({
  userId,
  projectId,
  content,
}: {
  userId: string
  projectId: string
  content: Record<string, unknown>
}): Promise<WriterProject> {
  return updateProjectField(userId, projectId, { content: content as unknown as Json })
}

export async function updateWriterProjectSettings({
  userId,
  projectId,
  settings,
}: {
  userId: string
  projectId: string
  settings: Record<string, unknown>
}): Promise<WriterProject> {
  return updateProjectField(userId, projectId, { settings: settings as unknown as Json })
}

// Shared update path: applies a partial patch scoped to the owner and returns
// the updated row. RLS plus the explicit user_id filter are belt-and-braces —
// a non-owner match returns zero rows and surfaces as a clear error.
async function updateProjectField(
  userId: string,
  projectId: string,
  patch: Partial<WriterProjectRow>,
): Promise<WriterProject> {
  if (!userId) throw new Error('updateWriterProject: userId is required')
  if (!projectId) throw new Error('updateWriterProject: projectId is required')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('writer_projects')
    // cast: see note in createWriterProject re: supabase-js write inference
    .update(patch as never)
    .eq('id', projectId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`updateWriterProject: ${error.message}`)
  if (!data) throw new Error('updateWriterProject: project not found or not owned by user')
  return toWriterProject(data as WriterProjectRow)
}
