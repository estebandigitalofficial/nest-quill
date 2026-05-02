import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { formatAZTimeShort } from '@/lib/utils/formatTime'
import ClassroomDetailTabs from './ClassroomDetailTabs'

type RouteContext = { params: Promise<{ classId: string }> }

export default async function AdminClassroomDetailPage({ params }: RouteContext) {
  const ctx = await getAdminContext()
  if (!ctx) return null

  const { classId } = await params
  const admin = createAdminClient()

  const [
    { data: classroom, error },
    { data: members },
    { data: assignments },
  ] = await Promise.all([
    admin
      .from('classrooms')
      .select('id, name, grade, subject, join_code, is_active, created_at, educator_id')
      .eq('id', classId)
      .single(),
    admin
      .from('classroom_members')
      .select('id, student_id, joined_at, profiles(display_name, email)')
      .eq('classroom_id', classId)
      .order('joined_at', { ascending: true }),
    admin
      .from('assignments')
      .select('id, title, tool, config, due_at, created_at, assignment_submissions(id, student_id, status, score, total, completed_at)')
      .eq('classroom_id', classId)
      .order('created_at', { ascending: false }),
  ])

  if (error || !classroom) notFound()

  const { data: educator } = await admin
    .from('profiles')
    .select('id, email')
    .eq('id', classroom.educator_id)
    .single()

  const backHref = classroom.is_active
    ? '/admin/classrooms'
    : '/admin/classrooms?filter=archived'

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

      {/* Back — preserves filter context */}
      <Link href={backHref}
        className="text-xs text-adm-muted hover:text-white transition-colors inline-block">
        ← Classrooms
      </Link>

      {/* Archived notice */}
      {!classroom.is_active && (
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3 text-xs text-amber-400">
          This classroom is archived. Students can no longer access it and the join code is inactive.
        </div>
      )}

      {/* Header */}
      <div className="bg-adm-surface rounded-2xl border border-adm-border px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-white">{classroom.name}</h1>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                classroom.is_active
                  ? 'bg-green-900 text-green-400'
                  : 'bg-adm-surface text-adm-subtle border border-adm-border'
              }`}>
                {classroom.is_active ? 'active' : 'archived'}
              </span>
            </div>
            <p className="text-sm text-adm-muted">
              {[classroom.grade ? `Grade ${classroom.grade}` : null, classroom.subject]
                .filter(Boolean).join(' · ') || 'No grade/subject set'}
            </p>
            <p className="text-xs text-adm-subtle">
              Educator:{' '}
              <span className="text-adm-muted">
                {educator?.email ?? classroom.educator_id}
              </span>
            </p>
          </div>
          <div className="text-right space-y-1 shrink-0">
            <p className="text-sm font-mono font-bold text-adm-muted tracking-widest">{classroom.join_code}</p>
            <p className="text-[10px] text-adm-subtle">Join code</p>
            <p className="text-[10px] text-adm-subtle">
              Created {formatAZTimeShort(classroom.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ClassroomDetailTabs
        members={(members ?? []) as unknown as Parameters<typeof ClassroomDetailTabs>[0]['members']}
        assignments={(assignments ?? []) as unknown as Parameters<typeof ClassroomDetailTabs>[0]['assignments']}
      />

    </div>
  )
}
