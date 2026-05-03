import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { getSetting } from '@/lib/settings/appSettings'
import ClassroomDisabled from '@/app/classroom/ClassroomDisabled'
import AssignmentRunner from './AssignmentRunner'

export const metadata: Metadata = { title: 'Assignment — Nest & Quill Classroom' }

type PageProps = { params: Promise<{ assignmentId: string }> }

export default async function AssignmentPage({ params }: PageProps) {
  const classroomEnabled = await getSetting('classroom_enabled', true)
  if (!classroomEnabled) return <ClassroomDisabled />

  const { assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/classroom/assignment/${assignmentId}`)}`)

  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={
        <Link href="/classroom/student" className="text-sm text-charcoal-light hover:text-oxford">← Dashboard</Link>
      } />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <AssignmentRunner assignmentId={assignmentId} />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
