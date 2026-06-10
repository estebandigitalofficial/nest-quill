// Source documents for a Writer Studio project.
//   GET  — list the signed-in user's files for this project
//   POST — upload a file (multipart form-data, field name "file")
// Both are owner-scoped via the helpers + RLS.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  listProjectFiles,
  uploadProjectFile,
  WriterFileError,
} from '@/lib/writer/projectFiles'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const files = await listProjectFiles({ userId: user.id, projectId })
    return NextResponse.json({ files })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not list files.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let file: File | null = null
  try {
    const form = await req.formData()
    const entry = form.get('file')
    if (entry instanceof File) file = entry
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })

  try {
    const uploaded = await uploadProjectFile({ userId: user.id, projectId, file })
    return NextResponse.json({ file: uploaded }, { status: 201 })
  } catch (err) {
    // Validation/ownership problems are client errors; everything else is 500.
    if (err instanceof WriterFileError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Upload failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
