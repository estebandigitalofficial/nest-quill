'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Assignment types the educator can author. Each one has saved content
// (questions, cards, passage, etc.) generated at creation time — students
// only complete what's stored, they cannot generate their own.
const ASSIGNMENT_TYPES = [
  { value: 'quiz',        label: 'Quiz',         desc: '5 multiple-choice questions',  hasScore: true  },
  { value: 'reading',     label: 'Reading',      desc: 'Passage + comprehension Qs',   hasScore: true  },
  { value: 'flashcards',  label: 'Flashcards',   desc: 'Term/definition cards',        hasScore: false },
  { value: 'study-guide', label: 'Study Guide',  desc: 'Terms, concepts, practice',    hasScore: false },
  { value: 'explain',     label: 'Explain It',   desc: 'Plain-language breakdown',     hasScore: false },
] as const

type AssignmentTypeValue = typeof ASSIGNMENT_TYPES[number]['value']

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ASSIGNMENT_TYPES.map(t => [t.value, t.label])
)
const SCORED_TYPES = new Set<string>(ASSIGNMENT_TYPES.filter(t => t.hasScore).map(t => t.value))

const COLOR_BG: Record<string, string> = {
  indigo:  'bg-indigo-500',
  violet:  'bg-violet-500',
  rose:    'bg-rose-500',
  amber:   'bg-amber-500',
  emerald: 'bg-emerald-500',
  sky:     'bg-sky-500',
  orange:  'bg-orange-500',
  pink:    'bg-pink-500',
}

interface StudentProfile {
  display_name: string
  avatar_emoji: string
  avatar_color: string
  xp: number
  level: number
  streak_days: number
}

interface StudentBadge {
  slug: string
  name: string
  emoji: string
}

interface Member {
  id: string
  student_id: string
  joined_at: string
  profiles: { display_name: string | null; email: string } | null
  student_profile: StudentProfile | null
  student_badges: StudentBadge[]
}

interface Submission {
  student_id: string
  status: string
  score: number | null
  total: number | null
  completed_at: string | null
}

interface Assignment {
  id: string
  title: string
  tool: string
  config: { topic?: string; subject?: string; grade?: number; source?: string; material?: string }
  content?: Record<string, unknown>
  due_at: string | null
  created_at: string
  assignment_submissions: Submission[]
}

interface ClassroomData {
  id: string
  name: string
  grade: number | null
  subject: string | null
  join_code: string
  created_at: string
}

export default function ClassDetail({ classId }: { classId: string }) {
  const router = useRouter()
  const [classroom, setClassroom] = useState<ClassroomData | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'assignments' | 'students'>('assignments')
  const [showAssign, setShowAssign] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState('')
  const [editGrade, setEditGrade] = useState<number | ''>('')
  const [editSubject, setEditSubject] = useState('')
  const [editing, setEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete modal state
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Assignment form state
  const [aTitle, setATitle] = useState('')
  const [aType, setAType] = useState<AssignmentTypeValue>('quiz')
  const [aSource, setASource] = useState<'topic' | 'material'>('topic')
  const [aTopic, setATopic] = useState('')
  const [aMaterial, setAMaterial] = useState('')
  const [aGrade, setAGrade] = useState<number | ''>('')
  const [aDue, setADue] = useState('')
  const [showMoreOpts, setShowMoreOpts] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  function resetAssignForm() {
    setATitle(''); setAType('quiz'); setASource('topic')
    setATopic(''); setAMaterial(''); setAGrade(''); setADue('')
    setShowMoreOpts(false); setAssignError(null)
  }

  useEffect(() => { fetchData() }, [classId])

  async function fetchData() {
    setLoading(true)
    const res = await fetch(`/api/classroom/classes/${classId}`)
    if (res.ok) {
      const data = await res.json()
      setClassroom(data.classroom)
      setMembers(data.members)
      setAssignments(data.assignments)
    }
    setLoading(false)
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    setAssignError(null)
    setAssigning(true)
    const body = {
      title: aTitle.trim(),
      type: aType,
      source: aSource,
      topic: aSource === 'topic' ? aTopic.trim() : undefined,
      material: aSource === 'material' ? aMaterial.trim() : undefined,
      grade: aGrade || undefined,
      dueAt: aDue || undefined,
    }
    const res = await fetch(`/api/classroom/classes/${classId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setAssignError(data.message); setAssigning(false); return }
    setAssignments(prev => [{ ...data.assignment, assignment_submissions: [] }, ...prev])
    resetAssignForm()
    setShowAssign(false)
    setAssigning(false)
  }

  function copyCode() {
    if (classroom) {
      navigator.clipboard.writeText(classroom.join_code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    }
  }

  function openEdit() {
    if (!classroom) return
    setEditName(classroom.name)
    setEditGrade(classroom.grade ?? '')
    setEditSubject(classroom.subject ?? '')
    setEditError(null)
    setShowEdit(true)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditError(null)
    setEditing(true)
    const res = await fetch(`/api/classroom/classes/${classId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, grade: editGrade || null, subject: editSubject || null }),
    })
    const data = await res.json()
    if (!res.ok) { setEditError(data.message); setEditing(false); return }
    setClassroom(data.classroom)
    setShowEdit(false)
    setEditing(false)
  }

  async function handleDelete() {
    setDeleteError(null)
    setDeleting(true)
    const res = await fetch(`/api/classroom/classes/${classId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setDeleteError(data.message)
      setDeleting(false)
      return
    }
    router.push(data.redirectTo ?? '/classroom/educator')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!classroom) {
    return <p className="text-center text-sm text-red-500 py-20">Class not found.</p>
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-oxford">{classroom.name}</h1>
          <p className="text-sm text-charcoal-light mt-0.5">
            {[classroom.grade ? `Grade ${classroom.grade}` : null, classroom.subject].filter(Boolean).join(' · ') || 'No grade/subject set'}
            {' · '}{members.length} student{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xl font-mono font-bold text-oxford tracking-widest">{classroom.join_code}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Join Code</p>
          </div>
          <button onClick={copyCode}
            className={`text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors ${codeCopied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {codeCopied ? '✓ Copied' : 'Copy'}
          </button>
          <button onClick={openEdit}
            className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors">
            Edit
          </button>
          <button onClick={() => { setDeleteError(null); setShowDelete(true) }}
            className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-red-200 bg-white text-red-500 hover:bg-red-50 transition-colors">
            Delete
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['assignments', 'students'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${activeTab === tab ? 'bg-white text-oxford shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab === 'assignments' ? `Assignments (${assignments.length})` : `Students (${members.length})`}
          </button>
        ))}
      </div>

      {/* ── Assignments tab ── */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">

          {/* New assignment form — generates and stores content at create time */}
          {showAssign ? (
            <form onSubmit={handleAssign} className="bg-white rounded-2xl border-2 border-brand-200 px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-oxford">New assignment</p>
                <button type="button" onClick={() => { resetAssignForm(); setShowAssign(false) }}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
              </div>

              <input required autoFocus
                placeholder="Assignment title — e.g. Fractions Quiz"
                value={aTitle} onChange={e => setATitle(e.target.value)}
                className={inputClass} />

              {/* Type picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ASSIGNMENT_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => setAType(t.value)}
                      className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        aType === t.value
                          ? 'border-brand-400 bg-brand-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <span className={`text-xs font-semibold ${aType === t.value ? 'text-brand-700' : 'text-gray-700'}`}>{t.label}</span>
                      <span className="text-[10px] text-gray-400 leading-tight">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Source picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Content source</label>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                  {(['topic', 'material'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setASource(s)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${aSource === s ? 'bg-white text-oxford shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {s === 'topic' ? 'Generate from topic' : 'Paste material'}
                    </button>
                  ))}
                </div>
              </div>

              {aSource === 'topic' ? (
                <input required placeholder="Topic — e.g. Adding fractions with unlike denominators"
                  value={aTopic} onChange={e => setATopic(e.target.value)}
                  className={inputClass} />
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-600">Material to study</label>
                    <span className={`text-[10px] font-medium ${aMaterial.length > 4000 ? 'text-amber-500' : 'text-gray-400'}`}>
                      {aMaterial.length}/5000
                    </span>
                  </div>
                  <textarea required rows={5} maxLength={5000}
                    placeholder="Paste a chapter, passage, vocabulary list, or any text students should study…"
                    value={aMaterial} onChange={e => setAMaterial(e.target.value)}
                    className={`${inputClass} resize-none`} />
                  {aMaterial.trim().length > 0 && aMaterial.trim().length < 50 && (
                    <p className="text-xs text-red-500">At least 50 characters required.</p>
                  )}
                </div>
              )}

              {/* More options toggle */}
              <button type="button" onClick={() => setShowMoreOpts(v => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors">
                {showMoreOpts ? '▲ Fewer options' : '▼ More options (grade, due date)'}
              </button>

              {showMoreOpts && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Grade</label>
                    <select value={aGrade} onChange={e => setAGrade(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
                      <option value="">Any grade</option>
                      {[1,2,3,4,5,6,7,8].map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Due date</label>
                    <input type="datetime-local" value={aDue} onChange={e => setADue(e.target.value)} className={inputClass} />
                  </div>
                </div>
              )}

              {assignError && <p className="text-sm text-red-500">{assignError}</p>}

              <div className="flex gap-3 pt-1">
                <button type="submit"
                  disabled={
                    assigning || !aTitle.trim() ||
                    (aSource === 'topic' && aTopic.trim().length < 3) ||
                    (aSource === 'material' && aMaterial.trim().length < 50)
                  }
                  className="bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                  {assigning ? 'Generating…' : 'Generate & Assign'}
                </button>
                <button type="button" onClick={() => { resetAssignForm(); setShowAssign(false) }}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
              <p className="text-[11px] text-gray-400">
                Content is generated now and saved to the assignment. Students complete the same activity you authored — they cannot create their own.
              </p>
            </form>
          ) : (
            <button onClick={() => setShowAssign(true)}
              className="w-full bg-white hover:bg-brand-50 border-2 border-dashed border-gray-200 hover:border-brand-300 text-brand-500 hover:text-brand-600 text-sm font-semibold py-3.5 rounded-2xl transition-all">
              + New Assignment
            </button>
          )}

          {/* Assignment list */}
          {assignments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 px-8 py-12 text-center space-y-3">
              <p className="text-lg font-bold text-gray-400">No assignments</p>
              <p className="font-semibold text-oxford">No assignments yet</p>
              <p className="text-sm text-charcoal-light">Create an assignment and your students will see it in their queue.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => {
                const completedCount = a.assignment_submissions.filter(s => s.status === 'complete').length
                const total = members.length
                const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0
                const typeLabel = TYPE_LABELS[a.tool] ?? a.tool
                const scored = SCORED_TYPES.has(a.tool)
                const scoredSubs = scored
                  ? a.assignment_submissions.filter(s => s.score !== null && s.total)
                  : []
                const avg = scoredSubs.length
                  ? Math.round(scoredSubs.reduce((sum, s) => sum + ((s.score ?? 0) / (s.total ?? 1)), 0) / scoredSubs.length * 100)
                  : null
                const allDone = total > 0 && completedCount === total
                const isOverdue = a.due_at && new Date(a.due_at) < new Date()

                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-gray-100 px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-bold text-gray-500 shrink-0">{typeLabel.charAt(0)}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-oxford text-sm truncate">{a.title}</p>
                          <p className="text-xs text-charcoal-light mt-0.5 truncate">
                            {typeLabel}
                            {a.config?.topic ? ` · ${a.config.topic}` : a.config?.source === 'material' ? ' · From material' : ''}
                            {a.due_at && (
                              <span className={isOverdue ? ' · text-red-500 font-medium' : ' · text-gray-400'}>
                                {' '}· Due {new Date(a.due_at).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-5 shrink-0">
                        <div className="text-center">
                          <p className={`text-base font-bold ${allDone ? 'text-green-600' : 'text-oxford'}`}>
                            {completedCount}/{total}
                          </p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Done</p>
                        </div>
                        {avg !== null && (
                          <div className="text-center">
                            <p className="text-base font-bold text-oxford">{avg}%</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Avg Score</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Completion progress bar */}
                    {total > 0 && (
                      <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-400' : 'bg-brand-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Edit modal ── */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-oxford text-base">Edit class</p>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Class name <span className="text-red-400">*</span></label>
                <input required autoFocus
                  value={editName} onChange={e => setEditName(e.target.value)}
                  placeholder="e.g. Period 3 — Math"
                  className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Grade</label>
                  <select value={editGrade} onChange={e => setEditGrade(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
                    <option value="">No grade</option>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Subject</label>
                  <input
                    value={editSubject} onChange={e => setEditSubject(e.target.value)}
                    placeholder="e.g. Math"
                    className={inputClass} />
                </div>
              </div>
              {editError && <p className="text-sm text-red-500">{editError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={editing || !editName.trim()}
                  className="bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                  {editing ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" onClick={() => setShowEdit(false)}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <div>
              <p className="font-semibold text-oxford text-base">Delete class?</p>
              <p className="text-sm text-charcoal-light mt-1">
                <span className="font-semibold text-oxford">{classroom.name}</span> will be archived. Students will lose access and the join code will stop working.
              </p>
            </div>
            {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleting}
                className="bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                {deleting ? 'Deleting…' : 'Delete class'}
              </button>
              <button onClick={() => setShowDelete(false)} disabled={deleting}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Students tab ── */}
      {activeTab === 'students' && (
        <div className="space-y-3">
          {members.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 px-8 py-12 text-center space-y-3">
              <p className="text-lg font-bold text-gray-400">No students</p>
              <p className="font-semibold text-oxford">No students yet</p>
              <p className="text-sm text-charcoal-light">
                Share the join code <span className="font-mono font-bold text-oxford">{classroom.join_code}</span> with your students.
              </p>
            </div>
          ) : (
            members.map(m => {
              const authName = m.profiles?.display_name || m.profiles?.email || 'Student'
              const sp = m.student_profile
              const heroName = sp?.display_name ?? authName
              const done = assignments.filter(a =>
                a.assignment_submissions.some(s => s.student_id === m.student_id && s.status === 'complete')
              ).length
              const quizSubs = assignments.flatMap(a =>
                a.assignment_submissions.filter(s => s.student_id === m.student_id && s.status === 'complete' && s.score != null && s.total)
              )
              const avgPct = quizSubs.length
                ? Math.round(quizSubs.reduce((acc, s) => acc + (s.score! / s.total!), 0) / quizSubs.length * 100)
                : null
              const avatarBg = sp ? (COLOR_BG[sp.avatar_color] ?? 'bg-indigo-500') : 'bg-gray-200'

              return (
                <div key={m.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 ${avatarBg} rounded-xl flex items-center justify-center text-2xl shrink-0`}>
                      {sp?.avatar_emoji ?? ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-oxford">{heroName}</p>
                        {sp && sp.streak_days >= 3 && <span className="text-xs font-bold text-amber-500">Streak</span>}
                      </div>
                      <p className="text-xs text-charcoal-light">
                        {sp ? `Level ${sp.level} · ${sp.xp} XP` : 'No avatar set yet'}
                        {m.profiles?.email && sp ? ` · ${m.profiles.email}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div>
                        <p className="text-sm font-bold text-oxford">{done}/{assignments.length}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Done</p>
                      </div>
                      {avgPct !== null && (
                        <div>
                          <p className="text-sm font-bold text-oxford">{avgPct}%</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Avg</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {sp && (
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full"
                        style={{ width: `${Math.min(100, (sp.xp % 500) / 5)}%` }} />
                    </div>
                  )}

                  {m.student_badges.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.student_badges.map(b => (
                        <span key={b.slug} title={b.name}
                          className="text-sm bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 flex items-center gap-1">
                          {b.emoji}
                          <span className="text-[10px] text-gray-500 font-medium">{b.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

const inputClass = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors bg-white'
