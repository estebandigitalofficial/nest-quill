'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Classroom {
  id: string
  name: string
  grade: number | null
  subject: string | null
  join_code: string
  created_at: string
  classroom_members: { count: number }[]
  assignments: { count: number }[]
}

export default function EducatorDashboard() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newGrade, setNewGrade] = useState<number | ''>('')
  const [newSubject, setNewSubject] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => { fetchClasses() }, [])

  async function fetchClasses() {
    setLoading(true)
    const res = await fetch('/api/classroom/classes')
    if (res.ok) {
      const data = await res.json()
      setClassrooms(data.classrooms ?? [])
    }
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)
    const res = await fetch('/api/classroom/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, grade: newGrade || undefined, subject: newSubject || undefined }),
    })
    const data = await res.json()
    if (!res.ok) { setCreateError(data.message); setCreating(false); return }
    setClassrooms(prev => [{ ...data.classroom, classroom_members: [{ count: 0 }], assignments: [{ count: 0 }] }, ...prev])
    setNewName(''); setNewGrade(''); setNewSubject(''); setShowCreate(false)
    setCreating(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-oxford">My Classes</h1>
          <p className="text-sm text-charcoal-light mt-1">{classrooms.length === 0 ? 'Create your first class to get started.' : `${classrooms.length} active ${classrooms.length === 1 ? 'class' : 'classes'}`}</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors">
          + New Class
        </button>
      </div>

      {/* Create class form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border-2 border-brand-200 px-6 py-6 space-y-4">
          <p className="font-semibold text-oxford">Create a new class</p>
          <div className="space-y-3">
            <input
              required
              placeholder="Class name (e.g. Mrs. Smith's 4th Grade)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-3">
              <select value={newGrade} onChange={e => setNewGrade(e.target.value ? Number(e.target.value) : '')}
                className={inputClass}>
                <option value="">Grade (optional)</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
              <input placeholder="Subject (optional)" value={newSubject} onChange={e => setNewSubject(e.target.value)} className={inputClass} />
            </div>
          </div>
          {createError && <p className="text-sm text-red-500">{createError}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={creating || !newName.trim()}
              className="bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              {creating ? 'Creating…' : 'Create Class'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Class list */}
      {classrooms.length === 0 && !showCreate ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-14 text-center space-y-4">
          <p className="text-xl font-bold text-gray-400">No classes</p>
          <p className="font-semibold text-oxford">No classes yet</p>
          <p className="text-sm text-charcoal-light">Create a class to get a join code for your students.</p>
          <button onClick={() => setShowCreate(true)}
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors">
            Create your first class →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {classrooms.map(cls => {
            const memberCount = cls.classroom_members?.[0]?.count ?? 0
            const assignmentCount = cls.assignments?.[0]?.count ?? 0
            return (
              <Link key={cls.id} href={`/classroom/educator/${cls.id}`}
                className="bg-white rounded-2xl border border-gray-100 hover:border-brand-200 px-6 py-5 flex items-center justify-between gap-4 transition-all hover:shadow-sm group">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center text-sm font-bold text-brand-500 shrink-0">C</div>
                  <div className="min-w-0">
                    <p className="font-semibold text-oxford truncate">{cls.name}</p>
                    <p className="text-xs text-charcoal-light mt-0.5">
                      {[cls.grade ? `Grade ${cls.grade}` : null, cls.subject].filter(Boolean).join(' · ') || 'No grade/subject set'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  <div className="text-center hidden sm:block">
                    <p className="text-lg font-bold text-oxford">{memberCount}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Students</p>
                  </div>
                  <div className="text-center hidden sm:block">
                    <p className="text-lg font-bold text-oxford">{assignmentCount}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Assignments</p>
                  </div>
                  <div className="bg-gray-100 rounded-lg px-3 py-1.5 text-center">
                    <p className="text-xs font-mono font-bold text-oxford tracking-widest">{cls.join_code}</p>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide">Join Code</p>
                  </div>
                  <span className="text-gray-400 group-hover:text-gray-600 transition-colors">→</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

const inputClass = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors bg-white'
