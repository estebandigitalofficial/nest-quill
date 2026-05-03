'use client'

import { useState, useEffect } from 'react'
import AvatarSetup from './AvatarSetup'
import CelebrationModal from './CelebrationModal'
import { levelProgress } from '@/lib/utils/xp'

// Display labels for each assignment type. The student no longer routes into
// the standalone learning tool — every assignment opens at
// /classroom/assignment/[id] and renders the educator-stored content.
const TYPE_LABELS: Record<string, string> = {
  quiz:           'Quiz',
  flashcards:     'Flashcards',
  explain:        'Explain It',
  'study-guide':  'Study Guide',
  reading:        'Reading',
  // Legacy assignments still map sensibly until educators recreate them.
  math:           'Math Practice',
  spelling:       'Spelling Practice',
  'study-helper': 'Study Helper',
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
  config: { topic?: string; grade?: number; subject?: string; mode?: string }
  due_at: string | null; created_at: string
  assignment_submissions: Submission[]
  className: string
}

interface CelebrationData {
  xpEarned: number; newXP: number; newLevel: number
  leveledUp: boolean; newStreak: number; newBadges: string[]
}

interface StoryReward {
  id: string
  milestone: number
  awardedAt: string
  requestId: string
  status: string
  title: string | null
}

function buildQuestHref(a: Assignment): string {
  return `/classroom/assignment/${a.id}`
}

function questSubtitle(a: Assignment): string {
  const typeLabel = TYPE_LABELS[a.tool] ?? a.tool
  const detail = a.config?.topic ?? (a.config?.mode ? (MAT_MODE_LABELS[a.config.mode] ?? a.config.mode) : null)
  const parts = [a.className, typeLabel, detail].filter(Boolean) as string[]
  return parts.join(' · ')
}

const MAT_MODE_LABELS: Record<string, string> = {
  quiz: 'Quiz', flashcards: 'Flashcards', explain: 'Explain It', 'study-guide': 'Study Guide',
}

function dueLabel(due_at: string | null): { text: string; overdue: boolean } | null {
  if (!due_at) return null
  const overdue = new Date(due_at) < new Date()
  return {
    text: overdue
      ? 'Overdue'
      : `Due ${new Date(due_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
    overdue,
  }
}

export default function StudentDashboard() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [stories, setStories] = useState<StoryReward[]>([])
  const [showCompleted, setShowCompleted] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null)
  const [celebration, setCelebration] = useState<CelebrationData | null>(null)
  const [showCustomize, setShowCustomize] = useState(false)

  useEffect(() => {
    fetchProfile()
    fetchData()
    fetchStories()
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

  async function fetchStories() {
    const res = await fetch('/api/classroom/student/stories')
    if (res.ok) {
      const data = await res.json()
      setStories(data.stories ?? [])
    }
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
    setJoinSuccess(`Joined "${data.classroom.name}"!`)
    setJoinCode(''); setJoining(false); fetchData()
  }

  function handleAvatarComplete(p: { display_name: string; avatar_emoji: string; avatar_color: string }) {
    setProfile(prev => prev
      ? { ...prev, ...p }
      : { ...p, xp: 0, level: 1, coins: 0, streak_days: 0 })
    setShowCustomize(false)
  }

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  // Profile auto-creates server-side; fall back to defaults defensively so
  // joining a class is never blocked on profile setup.
  const safeProfile: StudentProfile = profile ?? {
    display_name: 'Explorer',
    avatar_emoji: '🦊',
    avatar_color: 'indigo',
    xp: 0, level: 1, coins: 0, streak_days: 0,
  }

  if (showCustomize) {
    return (
      <div className="space-y-4">
        <button onClick={() => setShowCustomize(false)}
          className="text-sm font-semibold text-gray-500 hover:text-oxford">← Back to dashboard</button>
        <AvatarSetup onComplete={handleAvatarComplete} />
      </div>
    )
  }

  const prog = levelProgress(safeProfile.xp)
  const pending   = assignments.filter(a => a.assignment_submissions[0]?.status !== 'complete')
  const completed = assignments.filter(a => a.assignment_submissions[0]?.status === 'complete')
  const colorBg   = COLOR_BG[safeProfile.avatar_color] ?? 'bg-indigo-500'
  const [heroQuest, ...restQuests] = pending

  return (
    <div className="space-y-5">

      {celebration && (
        <CelebrationModal {...celebration} onClose={() => setCelebration(null)} />
      )}

      {/* ── Hero card ── (avatar is decorative; customization is opt-in via the
          explicit "Customize" button — never gates onboarding) */}
      <div className="bg-oxford rounded-2xl px-6 py-5 flex items-center gap-5">
        <div
          aria-hidden="true"
          className={`w-16 h-16 ${colorBg} rounded-2xl flex items-center justify-center text-4xl shrink-0 shadow-lg`}>
          {safeProfile.avatar_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-serif text-lg text-white leading-none">{safeProfile.display_name}</p>
            {safeProfile.streak_days >= 3 && (
              <span className="text-xs font-bold text-amber-500" title={`${safeProfile.streak_days}-day streak`}>Streak</span>
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
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-center">
            <p className="text-xl font-bold text-amber-400">{safeProfile.coins}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wide">Coins</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCustomize(true)}
            className="text-[10px] font-semibold text-white/60 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-2 py-1 transition-colors">
            Customize
          </button>
        </div>
      </div>

      {/* ── Join code (promoted when not enrolled) ── */}
      {!dataLoading && pending.length === 0 && completed.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-indigo-200 px-6 py-5 space-y-3">
          <div>
            <p className="font-semibold text-oxford">Join your class</p>
            <p className="text-xs text-charcoal-light mt-0.5">Enter the 6-character code your teacher gave you.</p>
          </div>
          <form onSubmit={handleJoin} className="flex gap-3 items-end">
            <input
              autoFocus
              placeholder="ABC123"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="flex-1 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-mono tracking-widest text-oxford placeholder:text-gray-300 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
            <button type="submit" disabled={joining || joinCode.length < 6}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap">
              {joining ? 'Joining…' : 'Join'}
            </button>
          </form>
          {joinError   && <p className="text-sm text-red-500">{joinError}</p>}
          {joinSuccess && <p className="text-sm text-green-600 font-medium">{joinSuccess}</p>}
        </div>
      )}

      {/* ── Quest board ── */}
      {dataLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : pending.length === 0 && completed.length === 0 ? (
        /* Empty state — no classes yet */
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-12 text-center space-y-2">
          <p className="font-semibold text-oxford">No assignments yet</p>
          <p className="text-sm text-charcoal-light">They&apos;ll show up here once you join a class above.</p>
        </div>
      ) : pending.length === 0 ? (
        /* All caught up */
        <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-5 text-center space-y-1">
          <p className="font-semibold text-green-800">All caught up!</p>
          <p className="text-sm text-green-600">You&apos;ve completed every quest. Check back when your teacher assigns more.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Active Quests ({pending.length})
          </p>

          {/* Featured next quest */}
          {heroQuest && (() => {
            const typeLabel = TYPE_LABELS[heroQuest.tool] ?? heroQuest.tool
            const due   = dueLabel(heroQuest.due_at)
            const href  = buildQuestHref(heroQuest)
            return (
              <a href={href}
                className="block bg-indigo-600 hover:bg-indigo-500 rounded-2xl px-6 py-5 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/15 rounded-xl flex items-center justify-center text-3xl shrink-0">
                    {typeLabel.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-0.5">Up next</p>
                    <p className="font-semibold text-white text-base truncate">{heroQuest.title}</p>
                    <p className="text-xs text-indigo-200 mt-0.5 truncate">
                      {questSubtitle(heroQuest)}
                    </p>
                    {due && (
                      <p className={`text-[11px] font-semibold mt-1 ${due.overdue ? 'text-red-300' : 'text-indigo-300'}`}>
                        {due.overdue ? '' : ''}{due.text}
                      </p>
                    )}
                  </div>
                  <span className="bg-white text-indigo-600 text-sm font-bold px-5 py-2.5 rounded-xl whitespace-nowrap shrink-0 group-hover:bg-indigo-50 transition-colors">
                    Start →
                  </span>
                </div>
              </a>
            )
          })()}

          {/* Remaining pending quests */}
          {restQuests.map(a => {
            const typeLabel = TYPE_LABELS[a.tool] ?? a.tool
            const due  = dueLabel(a.due_at)
            const href = buildQuestHref(a)
            return (
              <a key={a.id} href={href}
                className="block bg-white rounded-2xl border-2 border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center text-xl shrink-0">
                    {typeLabel.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-oxford text-sm truncate">{a.title}</p>
                    <p className="text-xs text-charcoal-light mt-0.5 truncate">
                      {questSubtitle(a)}
                    </p>
                    {due && (
                      <p className={`text-[11px] font-semibold mt-0.5 ${due.overdue ? 'text-red-500' : 'text-gray-400'}`}>
                        {due.overdue ? '' : ''}{due.text}
                      </p>
                    )}
                  </div>
                  <span className="text-indigo-600 text-xs font-bold shrink-0">Start →</span>
                </div>
              </a>
            )
          })}
        </div>
      )}

      {/* ── Story Rewards ── */}
      {stories.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Story Rewards ({stories.length})
          </p>
          {stories.map(s => (
            <div key={s.id}
              className="bg-white rounded-2xl border-2 border-amber-100 hover:border-amber-200 transition-all px-5 py-4 flex items-center gap-4">
              <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center text-sm font-bold text-amber-600 shrink-0">
                S
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-oxford text-sm truncate">
                  {s.title ?? `${safeProfile.display_name}'s Story`}
                </p>
                <p className="text-xs text-charcoal-light mt-0.5">
                  Milestone reward · {s.milestone} quest{s.milestone !== 1 ? 's' : ''} completed
                </p>
              </div>
              {s.status === 'complete' ? (
                <a href={`/story/${s.requestId}`}
                  className="bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl whitespace-nowrap transition-colors shrink-0">
                  Read →
                </a>
              ) : (
                <span className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-xl shrink-0">Creating…</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Completed quests (collapsed by default) ── */}
      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(v => !v)}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors w-full text-left"
          >
            <span>Completed ({completed.length})</span>
            <span className="text-gray-300 font-normal normal-case tracking-normal">{showCompleted ? '▲ hide' : '▼ show'}</span>
          </button>

          {showCompleted && (
            <div className="mt-3 space-y-2">
              {completed.map(a => {
                const typeLabel = TYPE_LABELS[a.tool] ?? a.tool
                const sub  = a.assignment_submissions[0]
                const pct  = sub?.score != null && sub?.total ? Math.round((sub.score / sub.total) * 100) : null
                return (
                  <div key={a.id}
                    className="bg-white rounded-2xl border border-gray-100 px-5 py-3.5 flex items-center gap-4 opacity-60">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-lg shrink-0">
                      {typeLabel.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-oxford text-sm truncate">{a.title}</p>
                      <p className="text-xs text-charcoal-light truncate">{a.className}</p>
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
        </div>
      )}

      {/* ── Study Helper CTA ── */}
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-sm font-bold text-indigo-500 shadow-sm shrink-0">SH</div>
          <div>
            <p className="font-semibold text-oxford text-sm">Study Helper</p>
            <p className="text-xs text-charcoal-light mt-0.5">Paste notes — get quizzes, flashcards & more</p>
          </div>
        </div>
        <a href="/learning/study-helper"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl whitespace-nowrap transition-colors shrink-0">
          Try it →
        </a>
      </div>

      {/* ── Join another class (secondary, only when already enrolled) ── */}
      {(pending.length > 0 || completed.length > 0) && (
        <div className="pt-2">
          <p className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-3">Join another class</p>
          <form onSubmit={handleJoin} className="flex gap-3 items-end">
            <input
              placeholder="Enter join code"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="flex-1 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-mono tracking-widest text-oxford placeholder:text-gray-300 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
            <button type="submit" disabled={joining || joinCode.length < 6}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
              {joining ? 'Joining…' : 'Join'}
            </button>
          </form>
          {joinError   && <p className="text-sm text-red-500 mt-2">{joinError}</p>}
          {joinSuccess && <p className="text-sm text-green-600 mt-2 font-medium">{joinSuccess}</p>}
        </div>
      )}

    </div>
  )
}
