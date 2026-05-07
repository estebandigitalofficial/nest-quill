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

// Operational SaaS tones — solid dark surface with a tinted border
// signaling state. Linear/Vercel approach: the tone communicates
// information through a thin colored edge, not through coloured
// backgrounds, gradients or glow.
const TONE_RING: Record<Tone, string> = {
  neutral: 'bg-adm-surface border-adm-border',
  green:   'bg-adm-surface border-emerald-700/60',
  amber:   'bg-adm-surface border-amber-700/60',
  red:     'bg-adm-surface border-rose-700/60',
  blue:    'bg-adm-surface border-sky-700/60',
  violet:  'bg-adm-surface border-violet-700/60',
  gold:    'bg-adm-surface border-amber-600/60',
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
    <div className={`relative rounded-lg border ${TONE_RING[tone]} ${className}`}>
      {children}
    </div>
  )
}
