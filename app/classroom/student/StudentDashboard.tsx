'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AvatarSetup from './AvatarSetup'
import CelebrationModal from './CelebrationModal'
import { levelProgress } from '@/lib/utils/xp'

const TOOL_META: Record<string, { emoji: string; label: string; path: string }> = {
  quiz:          { emoji: '🧠', label: 'Quiz',                 path: '/learning/quiz' },
  flashcards:    { emoji: '🃏', label: 'Flashcards',           path: '/learning/flashcards' },
  explain:       { emoji: '💡', label: 'Concept Explainer',    path: '/learning/explain' },
  'study-guide': { emoji: '📋', label: 'Study Guide',          path: '/learning/study-guide' },
  math:          { emoji: '🔢', label: 'Math Practice',        path: '/learning/math' },
  reading:       { emoji: '📖', label: 'Reading Comprehension', path: '/learning/reading' },
  spelling:      { emoji: '✏️', label: 'Spelling Practice',    path: '/learning/spelling' },
}

const COLOR_BG: Record<string, string> = {
  indigo: 'bg-indigo-500', violet: 'bg-violet-500', rose: 'bg-rose-500',
  amber: 'bg-amber-500', emerald: 'bg-emerald-500', sky: 'bg-sky-500',
  orange: 'bg-orange-500', pink: 'bg-pink-500',
}

interface StudentProfile {
  display_name: string
  avatar_emoji: string
  avatar_color: string
  xp: number
  level: number
  coins: number
  streak_days: number
}

interface Submission { status: string; score: number | null; total: number | null; completed_at: string | null }
interface Assignment {
  id: string; title: string; tool: string
  config: { topic?: string; grade?: number; subject?: string }
  due_at: string | null; created_at: string
  assignment_submissions: Submission[]
  className: string
}

interface CelebrationData {
  xpEarned: number; newXP: number; newLevel: number
  leveledUp: boolean; newStreak: number; newBadges: string[]
}

export default function StudentDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null)
  const [celebration, setCelebration] = useState<CelebrationData | null>(null)

  useEffect(() => {
    fetchProfile()
    fetchData()
    // Check for pending celebration from redirect
    const raw = sessionStorage.getItem('classroom_celebration')
    if (raw) { setCelebration(JSON.parse(raw)); sessionStorage.removeItem('classroom_celebration') }
  }, [])

  async function fetchProfile() {
    setProfileLoading(true)
    const res = await fetch('/api/classroom/student/profile')
    if (res.ok) {
      const data = await res.json()
      setProfile(data.profile ?? null)
    }
    setProfileLoading(false)
  }

  async function fetchData() {
    setDataLoading(true)
    const res = await fetch('/api/classroom/classes')
    if (res.ok) {
      const data = await res.json()
      const all = (data.memberships ?? []).flatMap((m: { classrooms: { name: string; assignments: Assignment[] } }) =>
        (m.classrooms?.assignments ?? []).map((a: Assignment) => ({ ...a, className: m.classrooms.name }))
      ).sort((a: Assignment, b: Assignment) => {
        const aDone = a.assignment_submissions[0]?.status === 'complete'
        const bDone = b.assignment_submissions[0]?.status === 'complete'
        if (aDone !== bDone) return aDone ? 1 : -1
        if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
        return 0
      })
      setAssignments(all)
    }
    setDataLoading(false)
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setJoinError(null); setJoinSuccess(null); setJoining(true)
    const res = await fetch('/api/classroom/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode }),
    })
    const data = await res.json()
    if (!res.ok) { setJoinError(data.message); setJoining(false); return }
    setJoinSuccess(`Joined "${data.classroom.name}"! 🎉`)
    setJoinCode(''); setJoining(false); fetchData()
  }

  function handleAvatarComplete(p: { display_name: string; avatar_emoji: string; avatar_color: string }) {
    setProfile({ ...p, xp: 0, level: 1, coins: 0, streak_days: 0 })
  }

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  // First-time setup
  if (!profile) return <AvatarSetup onComplete={handleAvatarComplete} />

  const prog = levelProgress(profile.xp)
  const pending = assignments.filter(a => a.assignment_submissions[0]?.status !== 'complete')
  const completed = assignments.filter(a => a.assignment_submissions[0]?.status === 'complete')
  const colorBg = COLOR_BG[profile.avatar_color] ?? 'bg-indigo-500'

  return (
    <div className="space-y-6">

      {celebration && (
        <CelebrationModal {...celebration} onClose={() => setCelebration(null)} />
      )}

      {/* Hero card — avatar + XP */}
      <div className="bg-oxford rounded-2xl px-6 py-5 flex items-center gap-5">
        <div className={`w-16 h-16 ${colorBg} rounded-2xl flex items-center justify-center text-4xl shrink-0 shadow-lg`}>
          {profile.avatar_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-serif text-lg text-white leading-none">{profile.display_name}</p>
            {profile.streak_days >= 3 && (
              <span className="text-sm" title={`${profile.streak_days}-day streak`}>🔥</span>
            )}
          </div>
          <p className="text-xs text-white/50 mb-2">Level {prog.level} · {prog.title}</p>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-white/40">
              <span>{prog.current} XP</span>
              <span>{prog.needed} XP to next level</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full transition-all duration-500"
                style={{ width: `${prog.pct}%` }} />
            </div>
          </div>
        </div>
        <div className="text-center shrink-0">
          <p className="text-xl font-bold text-amber-400">{profile.coins}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wide">Coins</p>
        </div>
      </div>

      {/* Join a class */}
      <form onSubmit={handleJoin} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex gap-3 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-semibold text-gray-500">Join a class</label>
          <input
            placeholder="Enter join code"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-mono tracking-widest text-oxford placeholder:text-gray-300 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
        </div>
        <button type="submit" disabled={joining || joinCode.length < 6}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
          {joining ? 'Joining…' : 'Join'}
        </button>
      </form>
      {joinError && <p className="text-sm text-red-500 px-1">{joinError}</p>}
      {joinSuccess && <p className="text-sm text-green-600 px-1 font-medium">{joinSuccess}</p>}

      {/* Quest board — pending */}
      {dataLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                ⚔️ Active Quests ({pending.length})
              </p>
              {pending.map(a => {
                const tool = TOOL_META[a.tool]
                const isOverdue = a.due_at && new Date(a.due_at) < new Date()
                const dueLabel = a.due_at
                  ? isOverdue
                    ? `⚠️ Overdue`
                    : `Due ${new Date(a.due_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
                  : null
                const params = new URLSearchParams()
                if (a.config?.topic) params.set('topic', a.config.topic)
                if (a.config?.grade) params.set('grade', String(a.config.grade))
                if (a.config?.subject) params.set('subject', a.config.subject)
                params.set('assignmentId', a.id)
                const href = tool ? `${tool.path}?${params.toString()}` : '#'

                return (
                  <div key={a.id}
                    className="bg-white rounded-2xl border-2 border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all px-5 py-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-2xl shrink-0">
                      {tool?.emoji ?? '📚'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-oxford text-sm truncate">{a.title}</p>
                      <p className="text-xs text-charcoal-light mt-0.5 truncate">
                        {a.className}{a.config?.topic ? ` · ${a.config.topic}` : ''}
                      </p>
                      {dueLabel && (
                        <p className={`text-[11px] font-semibold mt-1 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>{dueLabel}</p>
                      )}
                    </div>
                    <a href={href}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl whitespace-nowrap transition-colors shrink-0">
                      Start →
                    </a>
                  </div>
                )
              })}
            </div>
          )}

          {/* Completed quests */}
          {completed.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                ✅ Completed ({completed.length})
              </p>
              {completed.map(a => {
                const tool = TOOL_META[a.tool]
                const sub = a.assignment_submissions[0]
                const pct = sub?.score != null && sub?.total ? Math.round((sub.score / sub.total) * 100) : null
                return (
                  <div key={a.id}
                    className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4 opacity-70">
                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-2xl shrink-0">
                      {tool?.emoji ?? '📚'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-oxford text-sm truncate">{a.title}</p>
                      <p className="text-xs text-charcoal-light mt-0.5 truncate">{a.className}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {pct !== null ? (
                        <>
                          <p className="text-sm font-bold text-oxford">{pct}%</p>
                          <p className="text-[10px] text-gray-400">{sub.score}/{sub.total}</p>
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
          {assignments.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 px-8 py-14 text-center space-y-3">
              <div className="text-5xl">🗺️</div>
              <p className="font-semibold text-oxford">No quests yet</p>
              <p className="text-sm text-charcoal-light">Ask your teacher for the 6-character join code and enter it above.</p>
            </div>
          )}

          {pending.length === 0 && completed.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-5 text-center space-y-1">
              <p className="text-2xl">🎉</p>
              <p className="font-semibold text-green-800">All caught up!</p>
              <p className="text-sm text-green-600">You&apos;ve completed every quest. Check back when your teacher assigns more.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
