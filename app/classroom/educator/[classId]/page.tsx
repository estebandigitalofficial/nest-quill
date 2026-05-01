import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import ClassDetail from './ClassDetail'
import { getSetting } from '@/lib/settings/appSettings'
import ClassroomDisabled from '@/app/classroom/ClassroomDisabled'

export const metadata: Metadata = { title: 'Class — Nest & Quill Classroom' }

export default async function ClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const classroomEnabled = await getSetting('classroom_enabled', true)
  if (!classroomEnabled) return <ClassroomDisabled />

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/classroom/educator')

  const role = user.user_metadata?.account_type ?? 'parent'
  if (role !== 'educator') redirect('/classroom')

  const { classId } = await params

  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/classroom/educator" className="text-sm text-charcoal-light hover:text-oxford">← My Classes</Link>} />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <ClassDetail classId={classId} />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
