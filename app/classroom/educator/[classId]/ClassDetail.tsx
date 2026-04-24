'use client'

import { useState, useEffect } from 'react'

const TOOLS = [
  { value: 'quiz', label: '🧠 Quiz', hasScore: true },
  { value: 'flashcards', label: '🃏 Flashcards', hasScore: false },
  { value: 'explain', label: '💡 Concept Explainer', hasScore: false },
  { value: 'study-guide', label: '📋 Study Guide', hasScore: false },
  { value: 'math', label: '🔢 Math Practice', hasScore: false },
  { value: 'reading', label: '📖 Reading Comprehension', hasScore: false },
  { value: 'spelling', label: '✏️ Spelling Practice', hasScore: false },
]

interface Member {
  id: string
  student_id: string
  joined_at: string
  profiles: { display_name: string | null; email: string } | null
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
  config: { topic?: string; subject?: string; grade?: number }
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
  const [classroom, setClassroom] = useState<ClassroomData | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'assignments' | 'students'>('assignments')
  const [showAssign, setShowAssign] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  // Assignment form state
  const [aTitle, setATitle] = useState('')
  const [aTool, setATool] = useState('quiz')
  const [aTopic, setATopic] = useState('')
  const [aGrade, setAGrade] = useState<number | ''>('')
  const [aDue, setADue] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

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
    const res = await fetch(`/api/classroom/classes/${classId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: aTitle,
        tool: aTool,
        config: { topic: aTopic || undefined, grade: aGrade || undefined },
        dueAt: aDue || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setAssignError(data.message); setAssigning(false); return }
    setAssignments(prev => [{ ...data.assignment, assignment_submissions: [] }, ...prev])
    setATitle(''); setATool('quiz'); setATopic(''); setAGrade(''); setADue('')
    setShowAssign(false); setAssigning(false)
  }

  function copyCode() {
    if (classroom) {
      navigator.clipboard.writeText(classroom.join_code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    }
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
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-oxford">{classroom.name}</h1>
          <p className="text-sm text-charcoal-light mt-0.5">
            {[classroom.grade ? `Grade ${classroom.grade}` : null, classroom.subject].filter(Boolean).join(' · ') || 'No grade/subject set'}
            {' · '}{members.length} student{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xl font-mono font-bold text-oxford tracking-widest">{classroom.join_code}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Join Code</p>
          </div>
          <button onClick={copyCode}
            className={`text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors ${codeCopied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {codeCopied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['assignments', 'students'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${activeTab === tab ? 'bg-white text-oxford shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab === 'assignments' ? `Assignments (${assignments.length})` : `Students (${members.length})`}
          </button>
        ))}
      </div>

      {/* Assignments tab */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAssign(v => !v)}
              className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors">
              + New Assignment
            </button>
          </div>

          {showAssign && (
            <form onSubmit={handleAssign} className="bg-white rounded-2xl border-2 border-brand-200 px-6 py-6 space-y-4">
              <p className="font-semibold text-oxford">Create assignment</p>
              <input required placeholder="Assignment title (e.g. Fractions Quiz)" value={aTitle}
                onChange={e => setATitle(e.target.value)} className={inputClass} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Learning Tool</label>
                  <select value={aTool} onChange={e => setATool(e.target.value)} className={inputClass}>
                    {TOOLS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Grade (optional)</label>
                  <select value={aGrade} onChange={e => setAGrade(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
                    <option value="">Any grade</option>
                    {[1,2,3,4,5,6,7,8].map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
              </div>
              <input placeholder="Topic (e.g. Adding fractions with unlike denominators)" value={aTopic}
                onChange={e => setATopic(e.target.value)} className={inputClass} />
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Due date (optional)</label>
                <input type="datetime-local" value={aDue} onChange={e => setADue(e.target.value)} className={inputClass} />
              </div>
              {assignError && <p className="text-sm text-red-500">{assignError}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={assigning || !aTitle.trim()}
                  className="bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                  {assigning ? 'Assigning…' : 'Assign to Class'}
                </button>
                <button type="button" onClick={() => setShowAssign(false)}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {assignments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 px-8 py-12 text-center space-y-3">
              <div className="text-4xl">📋</div>
              <p className="font-semibold text-oxford">No assignments yet</p>
              <p className="text-sm text-charcoal-light">Create an assignment and your students will see it in their queue.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => {
                const completed = a.assignment_submissions.filter(s => s.status === 'complete').length
                const tool = TOOLS.find(t => t.value === a.tool)
                const avgScore = tool?.hasScore
                  ? a.assignment_submissions.filter(s => s.score !== null && s.total)
                    .map(s => Math.round(((s.score ?? 0) / (s.total ?? 1)) * 100))
                  : []
                const avg = avgScore.length ? Math.round(avgScore.reduce((a, b) => a + b, 0) / avgScore.length) : null
                const isOverdue = a.due_at && new Date(a.due_at) < new Date()

                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-gray-100 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-2xl shrink-0">{tool?.label.split(' ')[0]}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-oxford text-sm truncate">{a.title}</p>
                        <p className="text-xs text-charcoal-light mt-0.5">
                          {tool?.label.slice(2)} {a.config?.topic ? `· ${a.config.topic}` : ''}
                          {a.due_at && <span className={isOverdue ? ' · text-red-500' : ''}> · Due {new Date(a.due_at).toLocaleDateString()}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center">
                        <p className="text-base font-bold text-oxford">{completed}/{members.length}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Done</p>
                      </div>
                      {avg !== null && (
                        <div className="text-center">
                          <p className="text-base font-bold text-oxford">{avg}%</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Avg Score</p>
                        </div>
                      )}
                      <div className={`w-2 h-2 rounded-full ${completed === members.length && members.length > 0 ? 'bg-green-400' : 'bg-amber-400'}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Students tab */}
      {activeTab === 'students' && (
        <div className="space-y-3">
          {members.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 px-8 py-12 text-center space-y-3">
              <div className="text-4xl">🎒</div>
              <p className="font-semibold text-oxford">No students yet</p>
              <p className="text-sm text-charcoal-light">Share the join code <span className="font-mono font-bold text-oxford">{classroom.join_code}</span> with your students.</p>
            </div>
          ) : (
            members.map(m => {
              const name = m.profiles?.display_name || m.profiles?.email || 'Student'
              const done = assignments.filter(a =>
                a.assignment_submissions.some(s => s.student_id === m.student_id && s.status === 'complete')
              ).length
              return (
                <div key={m.id} className="bg-white rounded-2xl border border-gray-100 px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-50 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">
                      {name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-oxford">{name}</p>
                      <p className="text-xs text-charcoal-light">Joined {new Date(m.joined_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-oxford">{done}/{assignments.length}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Complete</p>
                  </div>
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
