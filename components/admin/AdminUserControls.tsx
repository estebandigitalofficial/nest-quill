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
  /** Lifetime Free books consumed (Entitlement Foundation). */
  freeBooksUsed?: number
}

const GRANT_TIERS: { value: 'single' | 'story_pack' | 'story_pro'; label: string }[] = [
  { value: 'single', label: 'Single book (16 pp)' },
  { value: 'story_pack', label: 'Story Pack book (24 pp)' },
  { value: 'story_pro', label: 'Story Pro book (32 pp)' },
]

export default function AdminUserControls({ userId, currentPlan, booksGenerated, booksLimit, freeBooksUsed = 0 }: Props) {
  const router = useRouter()
  const [plan, setPlan] = useState<PlanTier>(currentPlan)
  const [planState, setPlanState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [resetState, setResetState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [grantTier, setGrantTier] = useState<'single' | 'story_pack' | 'story_pro'>('single')
  const [grantState, setGrantState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function grantBook() {
    if (!confirm(`Grant one complimentary ${grantTier.replace('_', ' ')} book to this user? It becomes a real, consumable entitlement.`)) return
    setGrantState('saving')
    const res = await fetch(`/api/admin/users/${userId}/grant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'book', tier: grantTier, count: 1 }),
    })
    if (res.ok) {
      setGrantState('saved')
      setTimeout(() => { router.refresh(); setGrantState('idle') }, 1200)
    } else {
      setGrantState('error')
      setTimeout(() => setGrantState('idle'), 3000)
    }
  }

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

  async function resetFreeAllowance() {
    if (!confirm('Give this account its two lifetime Free books back (free_books_used → 0)? This is a commercial entitlement change and does not affect purchases or the legacy counter.')) return
    setResetState('saving')
    const res = await fetch(`/api/admin/users/${userId}/reset-free-allowance`, { method: 'POST' })
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
            className="text-xs bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-adm-text px-2.5 py-1.5 rounded-lg font-medium transition-colors"
          >
            {planState === 'saving' ? 'Saving…' : planState === 'saved' ? 'Saved ✓' : planState === 'error' ? 'Error' : 'Save'}
          </button>
        )}
      </div>

      {/* Free counter (authoritative) + legacy counter + reset */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-adm-muted font-mono" title="Lifetime Free books used (profiles.free_books_used)">free {freeBooksUsed}/2</span>
        <span className="text-[10px] text-adm-subtle font-mono" title="Legacy informational counter (books_generated); no longer enforces anything">· legacy {booksGenerated}/{currentPlan === 'free' ? 2 : booksLimit}</span>
        {freeBooksUsed > 0 && (
          <button
            onClick={resetFreeAllowance}
            disabled={resetState === 'saving'}
            title="Commercial entitlement: sets free_books_used back to 0"
            className="text-xs text-adm-muted hover:text-amber-400 disabled:opacity-50 transition-colors"
          >
            {resetState === 'saving' ? 'Resetting…' : resetState === 'saved' ? 'Reset ✓' : resetState === 'error' ? 'Error' : 'Reset Free allowance'}
          </button>
        )}
      </div>

      {/* Complimentary entitlement — the deliberate replacement for the Beta Mode bypass */}
      <div className="flex items-center gap-1.5">
        <select
          value={grantTier}
          onChange={e => setGrantTier(e.target.value as 'single' | 'story_pack' | 'story_pro')}
          disabled={grantState === 'saving'}
          className="bg-adm-surface border border-adm-border rounded-lg px-2 py-1 text-[11px] text-adm-text focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
        >
          {GRANT_TIERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          onClick={grantBook}
          disabled={grantState === 'saving'}
          className="text-[11px] bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 px-2 py-1 rounded-lg font-medium disabled:opacity-50 transition-colors"
        >
          {grantState === 'saving' ? 'Granting…' : grantState === 'saved' ? 'Granted ✓' : grantState === 'error' ? 'Error' : 'Grant 1 book'}
        </button>
      </div>
    </div>
  )
}
