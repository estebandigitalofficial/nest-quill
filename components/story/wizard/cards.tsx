'use client'

// Shared selectable cards/chips for the story wizard. User-facing copy uses
// "theme" instead of "setting" — the internal `setting` field name stays
// for back-compat with the synthesizer and DB column. Animations are pure
// CSS (see globals.css) and respect prefers-reduced-motion.

import Image from 'next/image'
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
  brave: 'Brave',
  curious: 'Curious',
  funny: 'Funny',
  shy: 'Shy',
  leader: 'Leader',
  adventurous: 'Adventurous',
  loyal: 'Loyal',
  clever: 'Clever',
  creative: 'Creative',
  determined: 'Determined',
  kind: 'Kind',
  energetic: 'Energetic',
  calm: 'Calm',
  mischievous: 'Mischievous',
  thoughtful: 'Thoughtful',
  imaginative: 'Imaginative',
  athletic: 'Athletic',
  optimistic: 'Optimistic',
  resilient: 'Resilient',
  compassionate: 'Compassionate',
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

// ── Themes (illustrated artwork with CSS-art fallback) ──
// Internal id stays `Setting` to keep the synthesizer + DB column
// stable; the user sees them as "themes" everywhere.
//
// Artwork pipeline:
//   1. Drop a real illustrated image at /public/images/themes/<setting>.webp
//      (recommended: 1200×900 painterly storybook style, sRGB, ~120 KB)
//   2. Add the setting key to THEMES_WITH_ARTWORK below.
//   3. The card automatically switches from CSS art → real artwork.
//
// Until artwork lands, themes keep the existing layered CSS art so the
// wizard always looks finished. The gradient + dark overlay always render
// underneath so labels stay readable in either mode.
const THEMES_WITH_ARTWORK = new Set<Setting>([
  // Add keys here as artwork is added to /public/images/themes/<key>.webp:
  // 'jungle', 'space', 'ocean', 'school', 'fantasy_kingdom', 'city',
])

export function themeBgUrl(setting: Setting): string | null {
  return THEMES_WITH_ARTWORK.has(setting) ? `/images/themes/${setting}.webp` : null
}

interface ThemePalette {
  label: string
  gradient: string
  description: string
  art: React.ReactNode
}

export const SETTING_META: Record<Setting, ThemePalette> = {
  jungle: {
    label: 'Jungle',
    description: 'Vines, animals, hidden paths',
    gradient: 'from-emerald-400 via-emerald-600 to-emerald-900',
    art: (
      <>
        {/* canopy silhouettes */}
        <span aria-hidden className="absolute -top-2 -left-3 w-20 h-10 bg-emerald-900/50 rounded-full blur-[2px]" />
        <span aria-hidden className="absolute -top-3 right-2 w-16 h-8 bg-emerald-950/40 rounded-full blur-[2px]" />
        {/* sun rays */}
        <span aria-hidden className="absolute top-2 right-4 w-12 h-12 rounded-full bg-amber-200/70 blur-md nq-glow" />
        {/* leaves drifting */}
        <span aria-hidden className="absolute bottom-2 left-3 w-3 h-5 rounded-full bg-lime-200/80 rotate-12 nq-drift" />
        <span aria-hidden className="absolute bottom-6 left-12 w-2.5 h-4 rounded-full bg-emerald-200/70 -rotate-12 nq-drift" style={{ animationDelay: '1.4s' }} />
        <span aria-hidden className="absolute bottom-3 right-8 w-2.5 h-4 rounded-full bg-lime-100/60 nq-drift" style={{ animationDelay: '0.7s' }} />
        {/* ground vines */}
        <span aria-hidden className="absolute bottom-0 inset-x-0 h-3 bg-emerald-950/60" />
      </>
    ),
  },
  space: {
    label: 'Space',
    description: 'Stars, planets, galaxies',
    gradient: 'from-indigo-900 via-violet-800 to-slate-950',
    art: (
      <>
        {/* nebula glow */}
        <span aria-hidden className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-fuchsia-500/30 blur-2xl nq-glow" />
        <span aria-hidden className="absolute -bottom-8 -left-6 w-20 h-20 rounded-full bg-indigo-400/30 blur-2xl nq-glow" style={{ animationDelay: '1s' }} />
        {/* planet */}
        <span aria-hidden className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 shadow-md" />
        <span aria-hidden className="absolute top-5 right-1 w-9 h-1.5 rounded-full bg-amber-100/50 -rotate-12" />
        {/* stars */}
        <span aria-hidden className="absolute top-3 left-4 w-1.5 h-1.5 rounded-full bg-white nq-twinkle" />
        <span aria-hidden className="absolute top-7 left-12 w-1 h-1 rounded-full bg-white nq-twinkle" style={{ animationDelay: '0.6s' }} />
        <span aria-hidden className="absolute bottom-5 left-6 w-1 h-1 rounded-full bg-white nq-twinkle" style={{ animationDelay: '1.2s' }} />
        <span aria-hidden className="absolute bottom-7 right-12 w-1.5 h-1.5 rounded-full bg-white nq-twinkle" style={{ animationDelay: '1.6s' }} />
        <span aria-hidden className="absolute top-12 right-20 w-1 h-1 rounded-full bg-white nq-twinkle" style={{ animationDelay: '0.3s' }} />
      </>
    ),
  },
  ocean: {
    label: 'Ocean',
    description: 'Waves, reefs, deep blue',
    gradient: 'from-sky-300 via-cyan-500 to-blue-900',
    art: (
      <>
        {/* sun */}
        <span aria-hidden className="absolute top-2 right-3 w-8 h-8 rounded-full bg-yellow-100/80 blur-[1px] nq-glow" />
        {/* fish */}
        <span aria-hidden className="absolute top-1/2 left-4 w-2 h-1.5 rounded-full bg-white/70 nq-drift" />
        <span aria-hidden className="absolute top-[60%] left-14 w-1.5 h-1 rounded-full bg-white/60 nq-drift" style={{ animationDelay: '1s' }} />
        {/* bubbles */}
        <span aria-hidden className="absolute bottom-8 left-6 w-1.5 h-1.5 rounded-full bg-white/70 nq-drift" style={{ animationDelay: '0.4s' }} />
        <span aria-hidden className="absolute bottom-4 left-10 w-1 h-1 rounded-full bg-white/60 nq-drift" style={{ animationDelay: '1.2s' }} />
        {/* wave layers */}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-7 bg-cyan-200/40 rounded-t-[100%] nq-wave origin-bottom" />
        <span aria-hidden className="absolute inset-x-0 bottom-1 h-5 bg-white/30 rounded-t-[100%] nq-wave origin-bottom" style={{ animationDelay: '1s' }} />
        <span aria-hidden className="absolute inset-x-0 bottom-2 h-3 bg-white/40 rounded-t-[100%] nq-wave origin-bottom" style={{ animationDelay: '0.5s' }} />
      </>
    ),
  },
  school: {
    label: 'School',
    description: 'Classrooms, friends, lessons',
    gradient: 'from-amber-200 via-orange-300 to-rose-400',
    art: (
      <>
        {/* sun */}
        <span aria-hidden className="absolute top-2 right-3 w-12 h-12 rounded-full bg-yellow-200/80 blur-[1px] nq-glow" />
        {/* schoolhouse silhouette */}
        <span aria-hidden className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-10 bg-rose-700/60 rounded-sm" />
        <span aria-hidden className="absolute bottom-12 left-1/2 -translate-x-1/2 w-0 h-0"
          style={{ borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderBottom: '8px solid rgba(190,18,60,0.7)' }} />
        {/* windows */}
        <span aria-hidden className="absolute bottom-5 left-[calc(50%-5px)] w-2.5 h-2.5 bg-yellow-100/80 rounded-sm" />
        {/* paper bits */}
        <span aria-hidden className="absolute top-6 left-4 w-3 h-3 bg-white/60 rotate-12 nq-drift" />
        <span aria-hidden className="absolute top-10 right-8 w-2.5 h-2.5 bg-white/60 -rotate-12 nq-drift" style={{ animationDelay: '0.8s' }} />
      </>
    ),
  },
  fantasy_kingdom: {
    label: 'Fantasy kingdom',
    description: 'Castles, magic, knights',
    gradient: 'from-fuchsia-500 via-purple-700 to-indigo-900',
    art: (
      <>
        {/* moon */}
        <span aria-hidden className="absolute top-2 right-3 w-8 h-8 rounded-full bg-pink-100/80 nq-glow" />
        {/* castle silhouette */}
        <span aria-hidden className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-12 bg-indigo-950/70" />
        <span aria-hidden className="absolute bottom-12 left-[calc(50%-6px)] w-3 h-4 bg-indigo-950/70" />
        <span aria-hidden className="absolute bottom-12 left-[calc(50%-12px)] w-2 h-2 bg-indigo-950/70" />
        <span aria-hidden className="absolute bottom-12 left-[calc(50%+6px)] w-2 h-2 bg-indigo-950/70" />
        {/* magical sparkles */}
        <span aria-hidden className="absolute top-3 left-3 w-1.5 h-1.5 rounded-full bg-pink-200 nq-twinkle" />
        <span aria-hidden className="absolute top-7 left-12 w-2 h-2 rounded-full bg-fuchsia-200 nq-twinkle" style={{ animationDelay: '0.4s' }} />
        <span aria-hidden className="absolute top-5 right-12 w-1.5 h-1.5 rounded-full bg-violet-200 nq-twinkle" style={{ animationDelay: '0.8s' }} />
        <span aria-hidden className="absolute bottom-6 right-4 w-1 h-1 rounded-full bg-pink-200 nq-twinkle" style={{ animationDelay: '1.2s' }} />
        <span aria-hidden className="absolute -bottom-2 -left-3 w-12 h-12 rounded-full bg-pink-300/30 blur-xl nq-glow" />
      </>
    ),
  },
  city: {
    label: 'City',
    description: 'Streets, parks, neighbors',
    gradient: 'from-slate-500 via-slate-700 to-slate-900',
    art: (
      <>
        {/* moon/sun */}
        <span aria-hidden className="absolute top-2 right-3 w-6 h-6 rounded-full bg-amber-200/80 nq-glow" />
        {/* skyline */}
        <span aria-hidden className="absolute bottom-0 left-1 w-6 h-12 bg-slate-900/80" />
        <span aria-hidden className="absolute bottom-0 left-8 w-8 h-16 bg-slate-950/80" />
        <span aria-hidden className="absolute bottom-0 left-16 w-5 h-10 bg-slate-900/80" />
        <span aria-hidden className="absolute bottom-0 left-[5.5rem] w-7 h-14 bg-slate-950/80" />
        <span aria-hidden className="absolute bottom-0 right-12 w-6 h-12 bg-slate-900/80" />
        <span aria-hidden className="absolute bottom-0 right-3 w-5 h-9 bg-slate-950/80" />
        {/* lit windows */}
        <span aria-hidden className="absolute bottom-6 left-3 w-1 h-1 bg-amber-200" />
        <span aria-hidden className="absolute bottom-9 left-10 w-1 h-1 bg-amber-200 nq-twinkle" />
        <span aria-hidden className="absolute bottom-8 left-[4.75rem] w-1 h-1 bg-amber-200" />
        <span aria-hidden className="absolute bottom-5 right-14 w-1 h-1 bg-amber-200 nq-twinkle" style={{ animationDelay: '0.6s' }} />
      </>
    ),
  },
}

export function SettingCard({
  setting, active, onClick,
}: { setting: Setting; active: boolean; onClick: () => void }) {
  const meta = SETTING_META[setting]
  const bgUrl = themeBgUrl(setting)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl border-2 text-left transition-all aspect-[4/3] sm:aspect-[5/3] min-h-[112px]',
        active
          ? 'border-brand-500 ring-2 ring-brand-200'
          : 'border-transparent hover:border-gray-300'
      )}>
      {/* Gradient is always present so labels stay readable even if the
          image 404s or hasn't loaded yet — and as a backdrop for CSS art. */}
      <div className={cn('absolute inset-0 bg-gradient-to-br', meta.gradient)} />
      {bgUrl ? (
        <Image
          src={bgUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, 200px"
          className="object-cover"
        />
      ) : (
        meta.art
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
      <div className="relative p-3 h-full flex flex-col justify-end">
        <p className="text-white font-semibold text-sm drop-shadow">{meta.label}</p>
        <p className="text-white/85 text-[11px] leading-tight drop-shadow-sm">{meta.description}</p>
      </div>
      {active && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white text-brand-600 flex items-center justify-center text-xs font-bold shadow">
          ✓
        </span>
      )}
    </button>
  )
}

// ── Conflict cards ─────────────────────────────────────────
export const CONFLICT_META: Record<Conflict, { label: string; sub: string }> = {
  lost_something:    { label: 'Lost something',     sub: "Find what's missing" },
  save_someone:      { label: 'Save someone',       sub: 'A rescue mission' },
  solve_mystery:     { label: 'Solve a mystery',    sub: 'Follow the clues' },
  overcome_fear:     { label: 'Overcome a fear',    sub: 'Be brave together' },
  win_challenge:     { label: 'Win a challenge',    sub: 'Train, try, succeed' },
  make_new_friend:   { label: 'Make a new friend',  sub: 'Build the courage to say hi' },
  face_a_bully:      { label: 'Face a bully',       sub: 'Stand up with kindness' },
  protect_home:      { label: 'Protect home',       sub: 'Keep family safe' },
  survive_storm:     { label: 'Survive a storm',    sub: 'Weather it together' },
  cross_a_journey:   { label: 'Cross a journey',    sub: 'Far places, long roads' },
  mend_a_friendship: { label: 'Mend a friendship',  sub: 'Make things right again' },
  learn_a_truth:     { label: 'Learn a truth',      sub: 'Something hidden surfaces' },
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
        'flex flex-col gap-0.5 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all min-h-[64px]',
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
  find_courage:        { label: 'Find courage',       sub: 'The bravery inside' },
  find_belonging:      { label: 'Find belonging',     sub: 'Where they fit in' },
  become_a_hero:       { label: 'Become a hero',      sub: 'Rise to the moment' },
  protect_someone:     { label: 'Protect someone',    sub: 'Keep them safe' },
  restore_balance:     { label: 'Restore balance',    sub: 'Make things right' },
  celebrate_together:  { label: 'Celebrate together', sub: 'Joy at the end of the road' },
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
        'flex flex-col gap-0.5 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all min-h-[64px]',
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
