import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import StudyHelper from './StudyHelper'
import { getSetting } from '@/lib/settings/appSettings'

export const metadata: Metadata = { title: 'Study Helper — Nest & Quill Learning Mode' }

export default async function StudyHelperPage({
  searchParams,
}: {
  searchParams: Promise<{ assignmentId?: string }>
}) {
  const [{ assignmentId }, charMax] = await Promise.all([
    searchParams,
    getSetting('max_pasted_text_length', 5000),
  ])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let assignmentMaterial: string | undefined
  let assignmentMode: 'quiz' | 'flashcards' | 'explain' | 'study-guide' | undefined
  let assignmentGrade: number | undefined

  if (assignmentId) {
    if (!user) {
      redirect(`/login?next=${encodeURIComponent(`/learning/study-helper?assignmentId=${assignmentId}`)}`)
    }

    // TODO: before larger school rollout, verify the logged-in user is a member of the
    // classroom this assignment belongs to. Currently safe because assignment IDs are UUIDs,
    // but a membership check (classrooms → classroom_members → student_id) should be added here
    // and mirrored in /api/classroom/assignments/[assignmentId]/submit.
    const admin = createAdminClient()
    const { data: assignment } = await admin
      .from('assignments')
      .select('config, tool')
      .eq('id', assignmentId)
      .eq('tool', 'study-helper')
      .single()

    if (assignment?.config) {
      const cfg = assignment.config as { material?: string; mode?: string; grade?: number }
      assignmentMaterial = cfg.material
      assignmentMode = cfg.mode as typeof assignmentMode
      assignmentGrade = cfg.grade
    }
  }

  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={
        assignmentId
          ? <Link href="/classroom/student" className="text-sm text-charcoal-light hover:text-oxford">← Dashboard</Link>
          : <Link href="/learning" className="text-sm text-charcoal-light hover:text-oxford">← Learning Mode</Link>
      } />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-xl mx-auto">
          {!assignmentId && (
            <div className="text-center mb-8 space-y-2">
              <p className="text-xl font-bold text-indigo-500">Study Helper</p>
              <h1 className="font-serif text-3xl text-oxford">Study Helper</h1>
              <p className="text-sm text-charcoal-light max-w-sm mx-auto">
                Paste your notes or homework, then choose how you want to study it.
              </p>
            </div>
          )}
          <StudyHelper
            isLoggedIn={!!user}
            assignmentId={assignmentId}
            assignmentMaterial={assignmentMaterial}
            assignmentMode={assignmentMode}
            assignmentGrade={assignmentGrade}
            charMax={charMax}
          />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
