'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createWriterProject,
  isWriterDocumentType,
  updateWriterProjectTitle,
  updateWriterProjectContent,
} from '@/lib/writer/projects'

// Server Action: create a draft Writer Studio project from the
// /writer/new form, then redirect into its (placeholder) workspace.
// Auth + ownership are enforced here and again by RLS in the helper.
export async function createWriterProjectAction(formData: FormData): Promise<void> {
  const documentType = String(formData.get('documentType') ?? '')
  const title = String(formData.get('title') ?? '')

  // Unknown/missing type — bounce back to the type chooser rather than error.
  if (!isWriterDocumentType(documentType)) {
    redirect('/writer/new')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const project = await createWriterProject({
    userId: user.id,
    title,
    documentType,
  })

  redirect(`/writer/${project.id}`)
}

// Result returned to the editor's useActionState so it can render a
// saved / unsaved / error indicator without navigating away.
export type SaveProjectState = {
  ok: boolean
  error?: string
  savedAt?: string
}

// Server Action (useActionState signature): saves the editable fields of a
// project in place. Updates the title when changed and writes the draft into
// content as { draft }. Ownership is enforced by the helpers (id + user_id)
// and by RLS.
export async function saveWriterProjectAction(
  _prev: SaveProjectState,
  formData: FormData,
): Promise<SaveProjectState> {
  const projectId = String(formData.get('projectId') ?? '')
  const title = String(formData.get('title') ?? '')
  const draft = String(formData.get('draft') ?? '')

  if (!projectId) return { ok: false, error: 'Missing project id.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You must be signed in to save.' }

  try {
    const trimmed = title.trim()
    if (trimmed) {
      await updateWriterProjectTitle({ userId: user.id, projectId, title: trimmed })
    }
    await updateWriterProjectContent({
      userId: user.id,
      projectId,
      content: { draft },
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save.' }
  }

  // Refresh the server-rendered page data so a later navigation/refresh
  // reflects the saved values.
  revalidatePath(`/writer/${projectId}`)
  return { ok: true, savedAt: new Date().toISOString() }
}
