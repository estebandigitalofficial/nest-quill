// ──────────────────────────────────────────────────────────────────────────
// Writer Studio — source document data-access helpers.
//
// Phase 1 (foundation): store an uploaded file in the private
// `writer-project-files` bucket and record its metadata in
// writer_project_files. No PDF processing, text extraction, embeddings, or AI.
//
// Everything is owner-scoped: storage objects are namespaced under the user id
// and table rows are filtered by user_id, with RLS enforcing both at the DB
// layer. The RLS-aware server client is used throughout (no service role).
//
// Import only from Route Handlers / Server Actions / Server Components.
// ──────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import type { WriterProjectFileRow } from '@/types/database'
import type { WriterProjectFile } from '@/types/writer'
import { getWriterProject } from '@/lib/writer/projects'

export const WRITER_FILES_BUCKET = 'writer-project-files'

// 25MB — must stay in sync with the bucket's file_size_limit.
export const MAX_FILE_BYTES = 25 * 1024 * 1024

// Accepted source types. Keyed by MIME with the canonical extension; DOCX MIME
// is occasionally mangled by browsers, so we also accept by extension below.
const ALLOWED: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
}
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'txt'])

export class WriterFileError extends Error {}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

// Resolve the storage extension from MIME, falling back to the filename
// extension (covers DOCX uploaded as application/octet-stream, etc.).
function resolveExtension(file: { type: string; name: string }): string | null {
  if (ALLOWED[file.type]) return ALLOWED[file.type]
  const ext = extensionOf(file.name)
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null
}

function toWriterProjectFile(row: WriterProjectFileRow): WriterProjectFile {
  return {
    id: row.id,
    project_id: row.project_id,
    user_id: row.user_id,
    file_name: row.file_name,
    file_type: row.file_type,
    file_size: row.file_size,
    storage_path: row.storage_path,
    upload_status: (row.upload_status as WriterProjectFile['upload_status']) ?? 'uploaded',
    created_at: row.created_at,
  }
}

// ── Upload ──────────────────────────────────────────────────────────────────

export async function uploadProjectFile({
  userId,
  projectId,
  file,
}: {
  userId: string
  projectId: string
  file: File
}): Promise<WriterProjectFile> {
  if (!userId) throw new WriterFileError('Not signed in.')
  if (!projectId) throw new WriterFileError('Missing project.')
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new WriterFileError('No file provided.')
  }

  // Ownership gate: only attach to a project the user owns. getWriterProject is
  // itself owner-scoped, so a foreign/nonexistent project resolves to null.
  const project = await getWriterProject({ userId, projectId })
  if (!project) throw new WriterFileError('Project not found.')

  if (file.size <= 0) throw new WriterFileError('File is empty.')
  if (file.size > MAX_FILE_BYTES) {
    throw new WriterFileError('File is too large (max 25MB).')
  }

  const ext = resolveExtension(file)
  if (!ext) {
    throw new WriterFileError('Unsupported file type. Allowed: PDF, DOCX, TXT.')
  }

  const supabase = await createClient()

  // Object name: "<user>/<project>/<file>.<ext>" — the leading user segment is
  // what storage RLS checks against auth.uid().
  const fileId = crypto.randomUUID()
  const storagePath = `${userId}/${projectId}/${fileId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(WRITER_FILES_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (uploadError) throw new WriterFileError(`Upload failed: ${uploadError.message}`)

  const insert: Partial<WriterProjectFileRow> = {
    id: fileId,
    project_id: projectId,
    user_id: userId,
    file_name: file.name.slice(0, 300),
    file_type: file.type || `application/${ext}`,
    file_size: file.size,
    storage_path: storagePath,
    upload_status: 'uploaded',
  }

  const { data, error } = await supabase
    .from('writer_project_files')
    .insert(insert as never)
    .select('*')
    .single()

  if (error) {
    // Best-effort cleanup so a failed insert doesn't orphan the object.
    await supabase.storage.from(WRITER_FILES_BUCKET).remove([storagePath])
    throw new WriterFileError(`Could not save file record: ${error.message}`)
  }

  return toWriterProjectFile(data as WriterProjectFileRow)
}

// ── List ────────────────────────────────────────────────────────────────────

export async function listProjectFiles({
  userId,
  projectId,
}: {
  userId: string
  projectId: string
}): Promise<WriterProjectFile[]> {
  if (!userId) throw new WriterFileError('Not signed in.')
  if (!projectId) throw new WriterFileError('Missing project.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('writer_project_files')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new WriterFileError(`Could not list files: ${error.message}`)
  return (data as WriterProjectFileRow[]).map(toWriterProjectFile)
}

// ── Delete ──────────────────────────────────────────────────────────────────

export async function deleteProjectFile({
  userId,
  projectId,
  fileId,
}: {
  userId: string
  projectId: string
  fileId: string
}): Promise<{ ok: true }> {
  if (!userId) throw new WriterFileError('Not signed in.')
  if (!fileId) throw new WriterFileError('Missing file.')

  const supabase = await createClient()

  // Fetch the owner-scoped row first to get its storage path.
  const { data: row, error: findError } = await supabase
    .from('writer_project_files')
    .select('*')
    .eq('id', fileId)
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (findError) throw new WriterFileError(`Could not load file: ${findError.message}`)
  if (!row) throw new WriterFileError('File not found.')

  const fileRow = row as WriterProjectFileRow

  // Remove the object (RLS lets users delete only their own folder), then the
  // row. Object removal first avoids orphaned rows pointing at gone files.
  const { error: storageError } = await supabase.storage
    .from(WRITER_FILES_BUCKET)
    .remove([fileRow.storage_path])
  if (storageError) throw new WriterFileError(`Could not delete file: ${storageError.message}`)

  const { error: deleteError } = await supabase
    .from('writer_project_files')
    .delete()
    .eq('id', fileId)
    .eq('user_id', userId)
  if (deleteError) throw new WriterFileError(`Could not delete record: ${deleteError.message}`)

  return { ok: true }
}
