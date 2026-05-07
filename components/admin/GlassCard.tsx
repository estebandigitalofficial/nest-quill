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

// Tones tuned for the parchment Command Center. Cards lift off the
// page with a soft drop shadow (shadow-md/xl + warm shadow color)
// plus solid mid-200 borders so card edges register without
// shouting. Text inside cards uses text-adm-text by default.
const TONE_RING: Record<Tone, string> = {
  neutral: 'from-white to-amber-50/60 border-amber-300',
  green:   'from-emerald-50 to-emerald-100/80 border-emerald-400',
  amber:   'from-amber-50 to-amber-100/80 border-amber-400',
  red:     'from-rose-50 to-rose-100/80 border-rose-400',
  blue:    'from-sky-50 to-sky-100/80 border-sky-400',
  violet:  'from-violet-50 to-violet-100/80 border-violet-400',
  gold:    'from-yellow-50 to-amber-100/80 border-yellow-500',
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
    <div className={`relative rounded-2xl border bg-gradient-to-br ${TONE_RING[tone]} shadow-md shadow-amber-900/10 ${className}`}>
      {children}
    </div>
  )
}
