'use client'

import { useState } from 'react'

const NUDGES = [
  'Try working it out on paper first.',
  'Pause and think — what do you already know?',
  'What part feels confusing?',
  'Guess the answer before you generate.',
  'Explain it to yourself first, then check.',
  'What would you try if you had to figure this out alone?',
  'Write one thing you already know about this topic.',
]

export default function NudgePrompt() {
  const [nudge] = useState<string | null>(() =>
    Math.random() < 0.35 ? NUDGES[Math.floor(Math.random() * NUDGES.length)] : null
  )

  if (!nudge) return null

  return (
    <p className="text-xs text-gray-400 italic text-center px-2">
      💭 {nudge}
    </p>
  )
}
