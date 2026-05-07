// Lightweight glass surface used on the Command Center and Beta Ops
// pages. Uses a soft tinted gradient + subtle border to lift the
// admin theme out of "dense black panel" territory without changing
// the admin layout's dark base.

import type { ReactNode } from 'react'

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'violet'

const TONE_RING: Record<Tone, string> = {
  neutral: 'from-white/5 to-white/[0.02] border-white/10',
  green:   'from-emerald-500/15 to-emerald-500/5 border-emerald-500/30',
  amber:   'from-amber-500/15 to-amber-500/5 border-amber-500/30',
  red:     'from-rose-500/15 to-rose-500/5 border-rose-500/30',
  blue:    'from-sky-500/15 to-sky-500/5 border-sky-500/30',
  violet:  'from-violet-500/15 to-violet-500/5 border-violet-500/30',
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
