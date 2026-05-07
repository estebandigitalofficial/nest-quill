// Lightweight glass surface used across the admin Command Center.
// Soft tinted gradient + subtle border, anchored on the dark admin
// theme so contrast stays intact for tables and forms.
//
// STATUS COLOR LANGUAGE
//   neutral — informational / no-state
//   green   — healthy / nominal
//   amber   — warning / watch
//   red     — action / critical
//   blue    — beta / informational signal
//   violet  — AI / generation
//   gold    — billing / revenue (uses the amber surface — same hue family)
//
// New code should reach for this primitive instead of hand-rolling
// border + bg classes so the visual language stays consistent.

import type { ReactNode } from 'react'

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'gold'

const TONE_RING: Record<Tone, string> = {
  neutral: 'from-white/5 to-white/[0.02] border-white/10',
  green:   'from-emerald-500/15 to-emerald-500/5 border-emerald-500/30',
  amber:   'from-amber-500/15 to-amber-500/5 border-amber-500/30',
  red:     'from-rose-500/15 to-rose-500/5 border-rose-500/30',
  blue:    'from-sky-500/15 to-sky-500/5 border-sky-500/30',
  violet:  'from-violet-500/15 to-violet-500/5 border-violet-500/30',
  gold:    'from-yellow-500/20 to-amber-500/5 border-yellow-400/30',
}

export default function GlassCard({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: Tone
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`relative rounded-2xl border bg-gradient-to-br ${TONE_RING[tone]} backdrop-blur-sm shadow-sm ${className}`}>
      {children}
    </div>
  )
}
