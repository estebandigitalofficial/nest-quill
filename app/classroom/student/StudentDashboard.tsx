'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const TOOL_LABELS: Record<string, { emoji: string; label: string; path: string }> = {
  quiz:         { emoji: '🧠', label: 'Quiz',                path: '/learning/quiz' },
  flashcards:   { emoji: '🃏', label: 'Flashcards',          path: '/learning/flashcards' },
  explain:      { emoji: '💡', label: 'Concept Explainer',   path: '/learning/explain' },
  'study-guide':{ emoji: '📋', label: 'Study Guide',         path: '/learning/study-guide' },
  math:         { emoji: '🔢', label: 'Math Practice',       path: '/learning/math' },
  reading:      { emoji: '📖', label: 'Reading Comprehension', path: '/learning/reading' },
  spelling:     { emoji: '✏️', label: 'Spelling Practice',   path: '/learning/spelling' },
}

interface Submission {
  status: string
  score: number | null
  total: number | null
  completed_at: string | null
}

interface Assignment {
  id: string
  title: string
  tool: string
  config: { topic?: string; grade?: number; subject?: string }
  due_at: string | null
  created_at: string
  assignment_submissions: Submission[]
}

interface ClassMembership {
  joined_at: string
  classrooms: {
    id: string
    name: string
    grade: number | null
    subject: string | null
    educator_id: string
    assignments: Assignment[]
  }
}

export default function StudentDashboard() {
  const [memberships, setMemberships] = useState<ClassMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const res = await fetch('/api/classroom/classes')
    if (res.ok) {
      const data = await res.json()
      setMemberships(data.memberships ?? [])
    }
    setLoading(false)
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setJoinError(null)
    setJoinSuccess(null)
    setJoining(true)
    const res = await fetch('/api/classroom/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode }),
    })
    const data = await res.json()
    if (!res.ok) { setJoinError(data.message); setJoining(false); return }
    setJoinSuccess(`Joined "${data.classroom.name}"!`)
    setJoinCode('')
    setJoining(false)
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  const allAssignments = memberships.flatMap(m =>
    (m.classrooms?.assignments ?? []).map(a => ({
      ...a,
      className: m.classrooms.name,
      classId: m.classrooms.id,
    }))
  ).sort((a, b) => {
    // Sort: incomplete first, then by due date
    const aDone = a.assignment_submissions[0]?.status === 'complete'
    const bDone = b.assignment_submissions[0]?.status === 'complete'
    if (aDone !== bDone) return aDone ? 1 : -1
    if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
    return 0
  })

  const pending = allAssignments.filter(a => a.assignment_submissions[0]?.status !== 'complete')
  const completed = allAssignments.filter(a => a.assignment_submissions[0]?.status === 'complete')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-oxford">My Assignments</h1>
        <p className="text-sm text-charcoal-light mt-1">
          {pending.length > 0 ? `${pending.length} pending · ${completed.length} done` : 'All caught up! 🎉'}
        </p>
      </div>

      {/* Join a class */}
      <form onSubmit={handleJoin} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex gap-3 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-semibold text-gray-600">Join a class</label>
          <input
            placeholder="Enter 6-character join code"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-mono tracking-widest text-oxford placeholder:text-gray-300 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
          />
        </div>
        <button type="submit" disabled={joining || joinCode.length < 6}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
          {joining ? 'Joining…' : 'Join'}
        </button>
      </form>
      {joinError && <p className="text-sm text-red-500 -mt-4 px-1">{joinError}</p>}
      {joinSuccess && <p className="text-sm text-green-600 -mt-4 px-1 font-medium">✓ {joinSuccess}</p>}

      {/* Pending assignments */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">To Do</p>
          {pending.map(a => {
            const tool = TOOL_LABELS[a.tool]
            const isOverdue = a.due_at && new Date(a.due_at) < new Date()
            const params = new URLSearchParams()
            if (a.config?.topic) params.set('topic', a.config.topic)
            if (a.config?.grade) params.set('grade', String(a.config.grade))
            if (a.config?.subject) params.set('subject', a.config.subject)
            params.set('assignmentId', a.id)
            const href = tool ? `${tool.path}?${params.toString()}` : '#'

            return (
              <div key={a.id} className="bg-white rounded-2xl border-2 border-gray-100 hover:border-indigo-200 px-5 py-4 flex items-center justify-between gap-4 transition-all">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-2xl shrink-0">{tool?.emoji ?? '📚'}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-oxford text-sm truncate">{a.title}</p>
                    <p className="text-xs text-charcoal-light mt-0.5">
                      {a.className}
                      {a.config?.topic && ` · ${a.config.topic}`}
                      {a.due_at && <span className={isOverdue ? ' · text-red-500 font-medium' : ' · text-gray-400'}> · Due {new Date(a.due_at).toLocaleDateString()}</span>}
                    </p>
                  </div>
                </div>
                <Link href={href}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap transition-colors shrink-0">
                  Start →
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {/* Completed assignments */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Completed</p>
          {completed.map(a => {
            const tool = TOOL_LABELS[a.tool]
            const sub = a.assignment_submissions[0]
            const pct = sub?.score != null && sub?.total ? Math.round((sub.score / sub.total) * 100) : null
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between gap-4 opacity-75">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-2xl shrink-0">{tool?.emoji ?? '📚'}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-oxford text-sm truncate">{a.title}</p>
                    <p className="text-xs text-charcoal-light mt-0.5">
                      {a.className}
                      {sub?.completed_at && ` · Done ${new Date(sub.completed_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {pct !== null ? (
                    <>
                      <p className="text-sm font-bold text-oxford">{pct}%</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{sub.score}/{sub.total}</p>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">✓ Done</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {allAssignments.length === 0 && memberships.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-14 text-center space-y-4">
          <div className="text-5xl">🎒</div>
          <p className="font-semibold text-oxford">No classes yet</p>
          <p className="text-sm text-charcoal-light">Ask your teacher for the 6-character join code and enter it above.</p>
        </div>
      )}
    </div>
  )
}
