'use client'

// Shared selectable cards/chips for the story wizard. Co-located so the
// step components stay light. Animations are pure CSS (see globals.css).

import { cn } from '@/lib/utils/cn'
import type {
  AgeTier,
  Trait,
  Setting,
  Conflict,
  Goal,
} from '@/lib/validators/story-form'
import type { IllustrationStyle } from '@/types/story'

// ── Age tier ────────────────────────────────────────────────
export const AGE_TIER_META: Record<AgeTier, { label: string; sub: string }> = {
  child:  { label: 'Child',       sub: 'Ages 1–12' },
  teen:   { label: 'Teen',        sub: 'Ages 13–17' },
  adult:  { label: 'Adult (18+)', sub: 'Mature themes available' },
}

export function AgeTierCard({
  tier, active, onClick,
}: { tier: AgeTier; active: boolean; onClick: () => void }) {
  const meta = AGE_TIER_META[tier]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 px-4 py-3 rounded-xl border-2 text-left transition-all',
        active
          ? 'border-brand-500 bg-brand-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      )}>
      <span className={cn('text-sm font-semibold', active ? 'text-brand-700' : 'text-gray-800')}>{meta.label}</span>
      <span className="text-[11px] text-gray-400">{meta.sub}</span>
    </button>
  )
}

// ── Traits ──────────────────────────────────────────────────
export const TRAIT_LABELS: Record<Trait, string> = {
  brave: 'Brave', curious: 'Curious', funny: 'Funny',
  shy: 'Shy', leader: 'Leader', adventurous: 'Adventurous',
}

export function TraitChip({
  trait, active, disabled, onClick,
}: { trait: Trait; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all',
        active
          ? 'border-brand-500 bg-brand-500 text-white'
          : disabled
          ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
          : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300'
      )}>
      {TRAIT_LABELS[trait]}
    </button>
  )
}

// ── Settings (themed cards with idle CSS animation) ────────
interface SettingPalette {
  label: string
  gradient: string
  description: string
  decoration: React.ReactNode
}

export const SETTING_META: Record<Setting, SettingPalette> = {
  jungle: {
    label: 'Jungle',
    description: 'Vines, animals, hidden paths',
    gradient: 'from-emerald-400 via-emerald-500 to-emerald-700',
    decoration: (
      <>
        <span aria-hidden className="absolute -bottom-3 -left-3 w-16 h-16 rounded-full bg-emerald-300/40 nq-drift" />
        <span aria-hidden className="absolute top-1 right-2 w-10 h-10 rounded-full bg-lime-200/60 nq-glow" />
      </>
    ),
  },
  space: {
    label: 'Space',
    description: 'Stars, planets, galaxies',
    gradient: 'from-indigo-700 via-violet-700 to-slate-900',
    decoration: (
      <>
        <span aria-hidden className="absolute top-3 left-4 w-1.5 h-1.5 rounded-full bg-white nq-twinkle" />
        <span aria-hidden className="absolute top-7 left-12 w-1 h-1 rounded-full bg-white nq-twinkle" style={{ animationDelay: '0.6s' }} />
        <span aria-hidden className="absolute bottom-4 right-6 w-2 h-2 rounded-full bg-white nq-twinkle" style={{ animationDelay: '1.2s' }} />
        <span aria-hidden className="absolute -bottom-4 -right-4 w-14 h-14 rounded-full bg-violet-400/40 nq-glow" />
      </>
    ),
  },
  ocean: {
    label: 'Ocean',
    description: 'Waves, reefs, deep blue',
    gradient: 'from-sky-400 via-cyan-500 to-blue-700',
    decoration: (
      <>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-6 bg-white/20 rounded-t-[100%] nq-wave origin-bottom" />
        <span aria-hidden className="absolute inset-x-0 bottom-1 h-4 bg-white/30 rounded-t-[100%] nq-wave origin-bottom" style={{ animationDelay: '1s' }} />
      </>
    ),
  },
  school: {
    label: 'School',
    description: 'Classrooms, friends, lessons',
    gradient: 'from-amber-300 via-orange-400 to-rose-400',
    decoration: (
      <span aria-hidden className="absolute top-2 right-2 w-12 h-12 rounded-full bg-yellow-200/50 nq-glow" />
    ),
  },
  fantasy_kingdom: {
    label: 'Fantasy kingdom',
    description: 'Castles, magic, knights',
    gradient: 'from-fuchsia-500 via-purple-600 to-indigo-700',
    decoration: (
      <>
        <span aria-hidden className="absolute top-3 left-3 w-1.5 h-1.5 rounded-full bg-pink-200 nq-twinkle" />
        <span aria-hidden className="absolute top-5 right-5 w-2 h-2 rounded-full bg-fuchsia-200 nq-twinkle" style={{ animationDelay: '0.4s' }} />
        <span aria-hidden className="absolute bottom-2 right-3 w-1.5 h-1.5 rounded-full bg-violet-200 nq-twinkle" style={{ animationDelay: '1s' }} />
        <span aria-hidden className="absolute -bottom-2 -left-3 w-12 h-12 rounded-full bg-pink-300/40 nq-glow" />
      </>
    ),
  },
  city: {
    label: 'City',
    description: 'Streets, parks, neighbors',
    gradient: 'from-slate-400 via-gray-500 to-slate-700',
    decoration: (
      <>
        <span aria-hidden className="absolute bottom-3 left-3 w-10 h-3 bg-white/30 rounded-sm" />
        <span aria-hidden className="absolute bottom-3 left-14 w-6 h-5 bg-white/25 rounded-sm" />
        <span aria-hidden className="absolute bottom-3 left-22 w-8 h-4 bg-white/35 rounded-sm" />
        <span aria-hidden className="absolute top-2 right-2 w-3 h-3 rounded-full bg-amber-200 nq-glow" />
      </>
    ),
  },
}

export function SettingCard({
  setting, active, onClick,
}: { setting: Setting; active: boolean; onClick: () => void }) {
  const meta = SETTING_META[setting]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl border-2 text-left transition-all aspect-[4/3] sm:aspect-[5/3]',
        active
          ? 'border-brand-500 ring-2 ring-brand-200'
          : 'border-transparent hover:border-gray-300'
      )}>
      <div className={cn('absolute inset-0 bg-gradient-to-br', meta.gradient)} />
      {meta.decoration}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      <div className="relative p-3 h-full flex flex-col justify-end">
        <p className="text-white font-semibold text-sm drop-shadow-sm">{meta.label}</p>
        <p className="text-white/80 text-[11px] leading-tight">{meta.description}</p>
      </div>
      {active && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white text-brand-600 flex items-center justify-center text-xs font-bold">
          ✓
        </span>
      )}
    </button>
  )
}

// ── Conflict cards ─────────────────────────────────────────
export const CONFLICT_META: Record<Conflict, { label: string; sub: string }> = {
  lost_something:  { label: 'Lost something',  sub: 'Find what\'s missing' },
  save_someone:    { label: 'Save someone',    sub: 'A rescue mission' },
  solve_mystery:   { label: 'Solve a mystery', sub: 'Follow the clues' },
  overcome_fear:   { label: 'Overcome a fear', sub: 'Be brave together' },
  win_challenge:   { label: 'Win a challenge', sub: 'Train, try, succeed' },
}

export function ConflictCard({
  conflict, active, onClick,
}: { conflict: Conflict; active: boolean; onClick: () => void }) {
  const meta = CONFLICT_META[conflict]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-0.5 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all',
        active
          ? 'border-brand-500 bg-brand-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      )}>
      <span className={cn('text-sm font-semibold', active ? 'text-brand-700' : 'text-gray-800')}>{meta.label}</span>
      <span className="text-[11px] text-gray-400">{meta.sub}</span>
    </button>
  )
}

// ── Goal cards ─────────────────────────────────────────────
export const GOAL_META: Record<Goal, { label: string; sub: string }> = {
  learn_lesson:        { label: 'Learn a lesson',     sub: 'Grow through the journey' },
  complete_mission:    { label: 'Complete a mission', sub: 'See it through to the end' },
  help_others:         { label: 'Help others',        sub: 'Make a difference' },
  discover_something:  { label: 'Discover something', sub: 'Wonder and curiosity' },
}

export function GoalCard({
  goal, active, onClick,
}: { goal: Goal; active: boolean; onClick: () => void }) {
  const meta = GOAL_META[goal]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-0.5 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all',
        active
          ? 'border-brand-500 bg-brand-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      )}>
      <span className={cn('text-sm font-semibold', active ? 'text-brand-700' : 'text-gray-800')}>{meta.label}</span>
      <span className="text-[11px] text-gray-400">{meta.sub}</span>
    </button>
  )
}

// ── Style cards (visual previews via CSS gradients, no images required) ─
const STYLE_GRADIENT: Record<IllustrationStyle, string> = {
  watercolor:    'from-rose-200 via-amber-200 to-sky-200',
  cartoon:       'from-yellow-300 via-orange-400 to-pink-500',
  storybook:     'from-amber-100 via-orange-200 to-red-300',
  pencil_sketch: 'from-stone-200 via-stone-400 to-stone-600',
  digital_art:   'from-fuchsia-500 via-violet-500 to-cyan-400',
}

export function StyleCard({
  style, label, description, active, locked, onClick,
}: {
  style: IllustrationStyle
  label: string
  description: string
  active: boolean
  locked?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl border-2 text-left transition-all',
        active
          ? 'border-brand-500'
          : locked
          ? 'border-gray-100 opacity-60 cursor-not-allowed'
          : 'border-gray-200 hover:border-gray-300'
      )}>
      <div className={cn('h-20 bg-gradient-to-br transition-transform duration-300 group-hover:scale-105', STYLE_GRADIENT[style])} />
      <div className="px-3 py-2.5 bg-white">
        <p className={cn('text-sm font-semibold', active ? 'text-brand-700' : 'text-gray-800')}>{label}</p>
        <p className="text-[11px] text-gray-400 leading-tight">{description}</p>
      </div>
      {locked && (
        <span className="absolute top-2 right-2 text-[10px] font-semibold text-gray-500 bg-white/90 px-1.5 py-0.5 rounded-full">
          Upgrade
        </span>
      )}
      {active && !locked && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold">
          ✓
        </span>
      )}
    </button>
  )
}
