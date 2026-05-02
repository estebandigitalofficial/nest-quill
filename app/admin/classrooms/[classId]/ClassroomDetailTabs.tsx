'use client'

import { useState } from 'react'
import { formatAZTimeShort } from '@/lib/utils/formatTime'

const TOOL_LABELS: Record<string, string> = {
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  explain: 'Concept Explainer',
  'study-guide': 'Study Guide',
  math: 'Math Practice',
  reading: 'Reading',
  spelling: 'Spelling',
  'study-helper': 'Study Helper',
}

interface MemberRow {
  id: string
  student_id: string
  joined_at: string
  profiles: { display_name: string | null; email: string } | null
}

interface SubmissionRow {
  id: string
  student_id: string
  status: string
  score: number | null
  total: number | null
  completed_at: string | null
}

interface AssignmentRow {
  id: string
  title: string
  tool: string
  config: Record<string, unknown>
  due_at: string | null
  created_at: string
  assignment_submissions: SubmissionRow[]
}

interface Props {
  members: MemberRow[]
  assignments: AssignmentRow[]
}

export default function ClassroomDetailTabs({ members, assignments }: Props) {
  const [tab, setTab] = useState<'overview' | 'students' | 'assignments' | 'submissions'>('overview')

  const memberCount = members.length
  const totalSubmissions = assignments.reduce((sum, a) => sum + a.assignment_submissions.length, 0)
  const completedSubmissions = assignments.reduce(
    (sum, a) => sum + a.assignment_submissions.filter(s => s.status === 'complete').length, 0
  )
  const completionRate = totalSubmissions > 0 ? Math.round((completedSubmissions / totalSubmissions) * 100) : 0

  const studentMap = new Map(members.map(m => [m.student_id, m]))

  const allSubmissions = assignments
    .flatMap(a => a.assignment_submissions.map(s => ({ ...s, assignmentTitle: a.title, assignmentTool: a.tool })))
    .sort((a, b) => {
      if (!a.completed_at && !b.completed_at) return 0
      if (!a.completed_at) return 1
      if (!b.completed_at) return -1
      return b.completed_at.localeCompare(a.completed_at)
    })

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'students', label: `Students (${memberCount})` },
    { id: 'assignments', label: `Assignments (${assignments.length})` },
    { id: 'submissions', label: `Submissions (${totalSubmissions})` },
  ] as const

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-adm-surface border border-adm-border rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              tab === t.id ? 'bg-white/10 text-white' : 'text-adm-muted hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Students" value={memberCount} />
          <StatCard label="Assignments" value={assignments.length} color="amber" />
          <StatCard label="Submissions" value={totalSubmissions} />
          <StatCard label="Completion" value={`${completionRate}%`} color="green" />
        </div>
      )}

      {/* ── Students ── */}
      {tab === 'students' && (
        <TableWrap>
          <thead>
            <HeadRow>
              <Th>Student</Th>
              <Th className="hidden sm:table-cell">Email</Th>
              <Th>Joined</Th>
            </HeadRow>
          </thead>
          <tbody className="divide-y divide-adm-border">
            {members.map(m => (
              <tr key={m.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white text-sm font-medium">{m.profiles?.display_name ?? '—'}</p>
                  <p className="text-[10px] text-adm-subtle font-mono">{m.student_id.slice(0, 8)}…</p>
                </td>
                <td className="px-4 py-3 text-adm-muted text-xs hidden sm:table-cell">
                  {m.profiles?.email ?? '—'}
                </td>
                <td className="px-4 py-3 text-adm-muted text-xs whitespace-nowrap">
                  {formatAZTimeShort(m.joined_at)}
                </td>
              </tr>
            ))}
            {members.length === 0 && <EmptyRow colSpan={3} message="No students yet." />}
          </tbody>
        </TableWrap>
      )}

      {/* ── Assignments ── */}
      {tab === 'assignments' && (
        <TableWrap>
          <thead>
            <HeadRow>
              <Th>Assignment</Th>
              <Th className="hidden sm:table-cell">Tool</Th>
              <Th>Progress</Th>
              <Th className="hidden md:table-cell">Due</Th>
              <Th className="hidden lg:table-cell">Created</Th>
            </HeadRow>
          </thead>
          <tbody className="divide-y divide-adm-border">
            {assignments.map(a => {
              const completed = a.assignment_submissions.filter(s => s.status === 'complete').length
              const pct = memberCount > 0 ? Math.round((completed / memberCount) * 100) : 0
              const isOverdue = a.due_at && new Date(a.due_at) < new Date()
              return (
                <tr key={a.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white text-sm font-medium">{a.title}</p>
                  </td>
                  <td className="px-4 py-3 text-adm-muted text-xs hidden sm:table-cell">
                    {TOOL_LABELS[a.tool] ?? a.tool}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-adm-muted font-mono">{completed}/{memberCount}</p>
                    <div className="mt-1 h-1 w-20 bg-adm-border rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs hidden md:table-cell">
                    {a.due_at
                      ? <span className={isOverdue ? 'text-red-400' : 'text-adm-muted'}>{formatAZTimeShort(a.due_at)}</span>
                      : <span className="text-adm-subtle">—</span>}
                  </td>
                  <td className="px-4 py-3 text-adm-muted text-xs hidden lg:table-cell whitespace-nowrap">
                    {formatAZTimeShort(a.created_at)}
                  </td>
                </tr>
              )
            })}
            {assignments.length === 0 && <EmptyRow colSpan={5} message="No assignments yet." />}
          </tbody>
        </TableWrap>
      )}

      {/* ── Submissions ── */}
      {tab === 'submissions' && (
        <TableWrap>
          <thead>
            <HeadRow>
              <Th>Student</Th>
              <Th className="hidden sm:table-cell">Assignment</Th>
              <Th>Status</Th>
              <Th className="hidden md:table-cell">Score</Th>
              <Th className="hidden lg:table-cell">Completed</Th>
            </HeadRow>
          </thead>
          <tbody className="divide-y divide-adm-border">
            {allSubmissions.map(s => {
              const member = studentMap.get(s.student_id)
              const name = member?.profiles?.display_name ?? member?.profiles?.email ?? `${s.student_id.slice(0, 8)}…`
              const hasScore = s.score !== null && s.total
              return (
                <tr key={s.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white text-sm font-medium">{name}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-adm-muted text-xs">{s.assignmentTitle}</p>
                    <p className="text-adm-subtle text-[10px]">{TOOL_LABELS[s.assignmentTool] ?? s.assignmentTool}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      s.status === 'complete'
                        ? 'bg-green-900 text-green-400'
                        : 'bg-amber-900/30 text-amber-400 border border-amber-900/50'
                    }`}>
                      {s.status === 'complete' ? 'complete' : 'in progress'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-adm-muted text-xs font-mono hidden md:table-cell">
                    {hasScore ? `${s.score}/${s.total}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-adm-muted text-xs hidden lg:table-cell whitespace-nowrap">
                    {s.completed_at ? formatAZTimeShort(s.completed_at) : '—'}
                  </td>
                </tr>
              )
            })}
            {allSubmissions.length === 0 && <EmptyRow colSpan={5} message="No submissions yet." />}
          </tbody>
        </TableWrap>
      )}
    </div>
  )
}

// ── Shared table sub-components ───────────────────────────────────────────────

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-adm-surface rounded-2xl border border-adm-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}

function HeadRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-adm-border text-xs text-adm-muted uppercase tracking-wider">
      {children}
    </tr>
  )
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left px-4 py-3 ${className}`}>{children}</th>
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-adm-subtle">{message}</td>
    </tr>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: 'green' | 'amber' }) {
  const valueColor = color === 'green' ? 'text-green-400' : color === 'amber' ? 'text-amber-400' : 'text-white'
  return (
    <div className="bg-adm-surface rounded-2xl border border-adm-border px-5 py-4">
      <p className="text-xs text-adm-muted mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}
