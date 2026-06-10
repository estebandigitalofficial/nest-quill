// DELETE a single source document from a Writer Studio project.
// Owner-scoped via the helper (id + user_id + project_id) and RLS.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteProjectFile, WriterFileError } from '@/lib/writer/projectFiles'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> },
) {
  const { projectId, fileId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await deleteProjectFile({ userId: user.id, projectId, fileId })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof WriterFileError) {
      const notFound = err.message === 'File not found.'
      return NextResponse.json({ error: err.message }, { status: notFound ? 404 : 400 })
    }
    const message = err instanceof Error ? err.message : 'Delete failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
