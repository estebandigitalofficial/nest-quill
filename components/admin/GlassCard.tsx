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

// Tones tuned for the parchment Command Center: gentle tinted washes
// over a cream surface, with borders strong enough to define the
// card edge but soft enough to stay editorial. Text inside cards
// uses text-adm-text by default (warm charcoal), so the tinted
// backgrounds intentionally stay pale.
const TONE_RING: Record<Tone, string> = {
  neutral: 'from-white/80 to-amber-50/40 border-amber-200/70',
  green:   'from-emerald-100/80 to-emerald-50/40 border-emerald-300/70',
  amber:   'from-amber-100/80 to-amber-50/40 border-amber-300/70',
  red:     'from-rose-100/80 to-rose-50/40 border-rose-300/70',
  blue:    'from-sky-100/80 to-sky-50/40 border-sky-300/70',
  violet:  'from-violet-100/80 to-violet-50/40 border-violet-300/70',
  gold:    'from-yellow-100/80 to-amber-50/40 border-yellow-400/70',
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
