'use client'

import { useEffect, useState } from 'react'
import { levelProgress, LEVEL_TITLES } from '@/lib/utils/xp'

interface Props {
  xpEarned: number
  newXP: number
  newLevel: number
  leveledUp: boolean
  newStreak: number
  newBadges: string[]
  onClose: () => void
}

const BADGE_INFO: Record<string, { name: string }> = {
  first_quest:   { name: 'First Quest' },
  quiz_master:   { name: 'Quiz Master' },
  high_scorer:   { name: 'High Scorer' },
  streak_3:      { name: '3-Day Streak' },
  streak_7:      { name: '7-Day Streak' },
  completionist: { name: 'Completionist' },
  speed_reader:  { name: 'Speed Reader' },
  math_whiz:     { name: 'Math Whiz' },
  wordsmith:     { name: 'Wordsmith' },
  ten_quests:    { name: '10 Quests Done' },
}

export default function CelebrationModal({ xpEarned, newXP, newLevel, leveledUp, newStreak, newBadges, onClose }: Props) {
  const [show, setShow] = useState(false)
  const prog = levelProgress(newXP)

  useEffect(() => {
    // Slight delay for the animation to feel satisfying
    const t = setTimeout(() => setShow(true), 50)
    return () => clearTimeout(t)
  }, [])

  function handleClose() {
    setShow(false)
    setTimeout(onClose, 200)
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center px-4 transition-all duration-200 ${show ? 'bg-black/50' : 'bg-transparent pointer-events-none'}`}>
      <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-sm px-7 py-8 text-center space-y-5 transition-all duration-300 ${show ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}>

        {leveledUp ? (
          <>
            <p className="text-3xl font-bold animate-bounce">Level Up!</p>
            <div>
              <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">Level Up!</p>
              <p className="font-serif text-3xl text-oxford">Level {newLevel}</p>
              <p className="text-sm text-charcoal-light mt-1">{LEVEL_TITLES[newLevel - 1]}</p>
            </div>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-indigo-500">Quest Complete!</p>
            <div>
              <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">Quest Complete!</p>
              <p className="font-serif text-3xl text-oxford">+{xpEarned} XP</p>
            </div>
          </>
        )}

        {/* XP bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Level {prog.level} · {prog.title}</span>
            <span>{prog.current} / {prog.needed} XP</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000"
              style={{ width: `${prog.pct}%` }}
            />
          </div>
        </div>

        {/* Streak */}
        {newStreak > 1 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-center gap-2">
            <span className="text-sm font-bold text-amber-600">Streak</span>
            <p className="text-sm font-semibold text-amber-700">{newStreak}-day streak!</p>
          </div>
        )}

        {/* New badges */}
        {newBadges.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Badge{newBadges.length > 1 ? 's' : ''} Earned</p>
            <div className="flex flex-wrap justify-center gap-2">
              {newBadges.map(slug => {
                const b = BADGE_INFO[slug]
                return b ? (
                  <div key={slug} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1.5">
                    <span className="text-xs font-semibold text-indigo-700">{b.name}</span>
                  </div>
                ) : null
              })}
            </div>
          </div>
        )}

        <button onClick={handleClose}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">
          Keep going →
        </button>
      </div>
    </div>
  )
}
