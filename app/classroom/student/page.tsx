import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import StudentDashboard from './StudentDashboard'

export const metadata: Metadata = { title: 'My Assignments — Nest & Quill Classroom' }

export default async function StudentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/classroom/student')

  const role = user.user_metadata?.account_type ?? 'parent'
  if (role === 'educator') redirect('/classroom/educator')
  if (role === 'parent') redirect('/classroom')

  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={
        <div className="flex items-center gap-4">
          <span className="text-xs text-charcoal-light hidden sm:block">Student</span>
          <Link href="/classroom" className="text-sm text-charcoal-light hover:text-oxford">← Classroom</Link>
        </div>
      } />
      <div className="flex-1 overflow-y-auto py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <StudentDashboard />
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
