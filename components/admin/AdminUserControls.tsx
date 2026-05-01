'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PlanTier } from '@/types/database'

const PLAN_OPTIONS: { value: PlanTier; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'single', label: 'Single Story' },
  { value: 'story_pack', label: 'Story Pack' },
  { value: 'story_pro', label: 'Story Pro' },
  { value: 'educator', label: 'Educator' },
]

interface Props {
  userId: string
  currentPlan: PlanTier
  booksGenerated: number
  booksLimit: number
}

export default function AdminUserControls({ userId, currentPlan, booksGenerated, booksLimit }: Props) {
  const router = useRouter()
  const [plan, setPlan] = useState<PlanTier>(currentPlan)
  const [planState, setPlanState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [resetState, setResetState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function savePlan() {
    if (plan === currentPlan) return
    setPlanState('saving')
    const res = await fetch(`/api/admin/users/${userId}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planTier: plan }),
    })
    if (res.ok) {
      setPlanState('saved')
      setTimeout(() => { router.refresh(); setPlanState('idle') }, 1200)
    } else {
      setPlanState('error')
      setTimeout(() => setPlanState('idle'), 3000)
    }
  }

  async function resetQuota() {
    setResetState('saving')
    const res = await fetch(`/api/admin/users/${userId}/reset-quota`, { method: 'POST' })
    if (res.ok) {
      setResetState('saved')
      setTimeout(() => { router.refresh(); setResetState('idle') }, 1200)
    } else {
      setResetState('error')
      setTimeout(() => setResetState('idle'), 3000)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Plan selector */}
      <div className="flex items-center gap-1.5">
        <select
          value={plan}
          onChange={e => setPlan(e.target.value as PlanTier)}
          disabled={planState === 'saving'}
          className="bg-adm-surface border border-adm-border rounded-lg px-2.5 py-1.5 text-xs text-adm-text focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
        >
          {PLAN_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {plan !== currentPlan && (
          <button
            onClick={savePlan}
            disabled={planState === 'saving'}
            className="text-xs bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors"
          >
            {planState === 'saving' ? 'Saving…' : planState === 'saved' ? 'Saved ✓' : planState === 'error' ? 'Error' : 'Save'}
          </button>
        )}
      </div>

      {/* Quota display + reset */}
      <div className="flex items-center gap-2">
        {/* Free accounts use a 2-story limit; books_limit in profiles may still show 1 */}
        <span className="text-xs text-adm-muted font-mono">{booksGenerated}/{currentPlan === 'free' ? 2 : booksLimit} used</span>
        {booksGenerated > 0 && (
          <button
            onClick={resetQuota}
            disabled={resetState === 'saving'}
            className="text-xs text-adm-muted hover:text-amber-400 disabled:opacity-50 transition-colors"
          >
            {resetState === 'saving' ? 'Resetting…' : resetState === 'saved' ? 'Reset ✓' : resetState === 'error' ? 'Error' : 'Reset quota'}
          </button>
        )}
      </div>
    </div>
  )
}
