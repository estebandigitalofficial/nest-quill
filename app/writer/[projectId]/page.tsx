import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { getWriterProject } from '@/lib/writer/projects'
import { listProjectFiles } from '@/lib/writer/projectFiles'
import { getProjectType } from '@/lib/writer/projectTypes'
import WriterEditor from '@/components/writer/WriterEditor'
import SourceDocuments from '@/components/writer/SourceDocuments'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Project — Writer Studio — Nest & Quill',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In progress',
  complete: 'Complete',
  archived: 'Archived',
}

export default async function WriterProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Scoped by user_id inside the helper — a project owned by someone else
  // (or one that doesn't exist) returns null and 404s here.
  const project = await getWriterProject({ userId: user.id, projectId })
  if (!project) notFound()

  const typeConfig = getProjectType(project.document_type)
  const typeName = typeConfig?.name ?? project.document_type

  // content is free-form jsonb; this workspace persists a single { draft } field.
  const rawDraft = (project.content as { draft?: unknown }).draft
  const initialDraft = typeof rawDraft === 'string' ? rawDraft : ''

  const files = await listProjectFiles({ userId: user.id, projectId })

  return (
    <div className="min-h-dvh bg-parchment flex flex-col">
      <SiteHeader
        right={
          <Link href="/writer" className="text-sm text-charcoal-light hover:text-oxford">
            ← Writer Studio
          </Link>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <Link
              href="/writer"
              className="text-sm text-charcoal-light hover:text-oxford font-medium"
            >
              ← My projects
            </Link>
          </div>

          <WriterEditor
            projectId={project.id}
            initialTitle={project.title}
            initialDraft={initialDraft}
            typeName={typeName}
            typeIcon={typeConfig?.icon ?? 'P'}
            statusLabel={STATUS_LABELS[project.status] ?? project.status}
            iconBg={typeConfig?.accent.iconBg ?? 'bg-oxford'}
            chipBg={typeConfig?.accent.chipBg ?? 'bg-parchment-dark'}
            chipText={typeConfig?.accent.chipText ?? 'text-charcoal'}
            outlineItems={typeConfig?.structure ?? []}
          />

          <div className="mt-6">
            <SourceDocuments projectId={project.id} initialFiles={files} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
