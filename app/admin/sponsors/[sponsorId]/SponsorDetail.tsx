'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const inputClass = 'w-full text-sm bg-adm-bg border border-adm-border rounded-lg px-3 py-2 text-adm-text focus:outline-none focus:ring-1 focus:ring-brand-500'

interface Sponsor {
  id: string
  name: string
  logo_url: string | null
  description: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website_url: string | null
  total_budget_cents: number
  is_active: boolean
  notes: string | null
}

interface Allocation {
  id: string
  category: string
  allocated_cents: number
  spent_cents: number
  notes: string | null
}

interface Reward {
  id: string
  title: string
  description: string | null
  reward_type: 'free_item' | 'discount' | 'digital_reward'
  value_cents: number
  max_redemptions: number | null
  redemption_count: number
  unlock_condition: Record<string, unknown>
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
}

const ALLOCATION_CATEGORIES = ['rewards', 'prizes', 'promotion', 'other'] as const
const REWARD_TYPES: { value: Reward['reward_type']; label: string }[] = [
  { value: 'free_item',      label: 'Free item' },
  { value: 'discount',       label: 'Discount' },
  { value: 'digital_reward', label: 'Digital reward' },
]
const UNLOCK_TYPES = [
  { value: 'points',      label: 'Points threshold' },
  { value: 'achievement', label: 'Achievement / badge' },
  { value: 'completion',  label: 'Completion' },
] as const

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function SponsorDetail({
  sponsor: initialSponsor,
  initialAllocations,
  initialRewards,
}: {
  sponsor: Sponsor
  initialAllocations: Allocation[]
  initialRewards: Reward[]
}) {
  const router = useRouter()
  const [sponsor, setSponsor] = useState(initialSponsor)
  const [allocations, setAllocations] = useState(initialAllocations)
  const [rewards, setRewards] = useState(initialRewards)

  // ── Sponsor form ─────────────────────────────────────────────
  const [draft, setDraft] = useState(initialSponsor)
  const [savingSponsor, setSavingSponsor] = useState(false)
  const [sponsorError, setSponsorError] = useState<string | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(sponsor)

  async function saveSponsor() {
    setSavingSponsor(true)
    setSponsorError(null)
    const res = await fetch(`/api/admin/sponsors/${sponsor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name.trim(),
        logo_url: draft.logo_url ?? null,
        description: draft.description ?? null,
        contact_name: draft.contact_name ?? null,
        contact_email: draft.contact_email ?? null,
        contact_phone: draft.contact_phone ?? null,
        website_url: draft.website_url ?? null,
        total_budget_cents: draft.total_budget_cents,
        is_active: draft.is_active,
        notes: draft.notes ?? null,
      }),
    })
    const data = await res.json()
    setSavingSponsor(false)
    if (!res.ok) { setSponsorError(data.error ?? 'Save failed.'); return }
    setSponsor(data.sponsor); setDraft(data.sponsor)
  }

  async function deleteSponsor() {
    if (!confirm(`Delete "${sponsor.name}" and all its rewards? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/sponsors/${sponsor.id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Delete failed.'); return }
    router.push('/admin/sponsors')
    router.refresh()
  }

  // ── Allocations ──────────────────────────────────────────────
  async function saveAllocation(category: string, dollars: string) {
    const cents = Math.max(0, Math.round(Number(dollars) * 100))
    const res = await fetch(`/api/admin/sponsors/${sponsor.id}/allocations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, allocated_cents: cents }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? 'Allocation failed.'); return }
    setAllocations(data.allocations)
  }

  const allocatedTotal = allocations.reduce((sum, a) => sum + a.allocated_cents, 0)
  const remaining = sponsor.total_budget_cents - allocatedTotal

  // ── Rewards ──────────────────────────────────────────────────
  const [showNewReward, setShowNewReward] = useState(false)
  async function createReward(reward: Omit<Reward, 'id' | 'redemption_count'>) {
    const res = await fetch(`/api/admin/sponsors/${sponsor.id}/rewards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reward),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? 'Reward creation failed.'); return }
    setRewards(prev => [data.reward, ...prev])
    setShowNewReward(false)
  }
  async function toggleReward(reward: Reward) {
    const res = await fetch(`/api/admin/sponsors/${sponsor.id}/rewards/${reward.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !reward.is_active }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? 'Update failed.'); return }
    setRewards(prev => prev.map(r => r.id === reward.id ? data.reward : r))
  }
  async function deleteReward(reward: Reward) {
    if (!confirm(`Delete reward "${reward.title}"?`)) return
    const res = await fetch(`/api/admin/sponsors/${sponsor.id}/rewards/${reward.id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Delete failed.'); return }
    setRewards(prev => prev.filter(r => r.id !== reward.id))
  }

  return (
    <div className="space-y-8">
      {/* Sponsor details */}
      <Section title="Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name" required>
            <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} maxLength={120} className={inputClass} />
          </Field>
          <Field label="Status">
            <label className="flex items-center gap-2 text-sm text-adm-text">
              <input type="checkbox" checked={draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} />
              Active
            </label>
          </Field>
          <Field label="Logo URL">
            <input value={draft.logo_url ?? ''} onChange={e => setDraft({ ...draft, logo_url: e.target.value || null })} className={`${inputClass} font-mono text-xs`} />
          </Field>
          <Field label="Website">
            <input value={draft.website_url ?? ''} onChange={e => setDraft({ ...draft, website_url: e.target.value || null })} className={`${inputClass} font-mono text-xs`} />
          </Field>
          <Field label="Contact name">
            <input value={draft.contact_name ?? ''} onChange={e => setDraft({ ...draft, contact_name: e.target.value || null })} className={inputClass} />
          </Field>
          <Field label="Contact email">
            <input type="email" value={draft.contact_email ?? ''} onChange={e => setDraft({ ...draft, contact_email: e.target.value || null })} className={inputClass} />
          </Field>
          <Field label="Contact phone">
            <input value={draft.contact_phone ?? ''} onChange={e => setDraft({ ...draft, contact_phone: e.target.value || null })} className={inputClass} />
          </Field>
          <Field label="Total budget" hint="Dollars">
            <div className="flex items-center gap-2">
              <span className="text-adm-muted text-sm">$</span>
              <input
                type="number" step="0.01" min="0"
                value={(draft.total_budget_cents / 100).toString()}
                onChange={e => setDraft({ ...draft, total_budget_cents: Math.max(0, Math.round(Number(e.target.value) * 100)) })}
                className={`${inputClass} max-w-32`} />
            </div>
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea rows={2} value={draft.description ?? ''} onChange={e => setDraft({ ...draft, description: e.target.value || null })} className={`${inputClass} resize-none`} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Internal notes" hint="Not shown to students.">
              <textarea rows={2} value={draft.notes ?? ''} onChange={e => setDraft({ ...draft, notes: e.target.value || null })} className={`${inputClass} resize-none`} />
            </Field>
          </div>
        </div>
        {sponsorError && <p className="text-sm text-red-400 mt-3">{sponsorError}</p>}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={saveSponsor}
            disabled={!dirty || savingSponsor || !draft.name.trim()}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            {savingSponsor ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
          <button
            onClick={deleteSponsor}
            className="text-sm font-semibold text-red-400 hover:text-red-300 transition-colors ml-auto">
            Delete sponsor
          </button>
        </div>
      </Section>

      {/* Budget allocations */}
      <Section
        title="Budget allocations"
        subtitle={`Total ${fmt(sponsor.total_budget_cents)} · Allocated ${fmt(allocatedTotal)} · Remaining ${fmt(remaining)}`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ALLOCATION_CATEGORIES.map(cat => {
            const row = allocations.find(a => a.category === cat)
            return (
              <AllocationRow
                key={cat}
                category={cat}
                row={row}
                onSave={(dollars) => saveAllocation(cat, dollars)}
              />
            )
          })}
        </div>
      </Section>

      {/* Rewards */}
      <Section
        title="Reward offers"
        subtitle={`${rewards.length} offer${rewards.length === 1 ? '' : 's'}`}
        action={
          <button
            onClick={() => setShowNewReward(true)}
            className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
            + New reward
          </button>
        }
      >
        {showNewReward && (
          <NewRewardForm
            onCancel={() => setShowNewReward(false)}
            onCreate={createReward}
          />
        )}
        {rewards.length === 0 && !showNewReward ? (
          <p className="text-sm text-adm-muted text-center py-6">No rewards yet.</p>
        ) : (
          <div className="space-y-2">
            {rewards.map(r => (
              <RewardRow key={r.id} reward={r} onToggle={() => toggleReward(r)} onDelete={() => deleteReward(r)} />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────

function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-adm-surface border border-adm-border rounded-xl p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-adm-text">{title}</h2>
          {subtitle && <p className="text-xs text-adm-muted mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-adm-muted uppercase tracking-widest">
        {label}{required && <span className="text-brand-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-adm-subtle">{hint}</p>}
    </div>
  )
}

function AllocationRow({ category, row, onSave }: {
  category: string
  row?: Allocation
  onSave: (dollars: string) => void
}) {
  const [draft, setDraft] = useState(((row?.allocated_cents ?? 0) / 100).toString())
  const dirty = Number(draft) !== ((row?.allocated_cents ?? 0) / 100)
  return (
    <div className="bg-adm-bg/50 border border-adm-border rounded-xl px-4 py-3">
      <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-2">{category}</p>
      <div className="flex items-center gap-2">
        <span className="text-adm-muted text-sm">$</span>
        <input type="number" step="0.01" min="0" value={draft} onChange={e => setDraft(e.target.value)} className={`${inputClass} max-w-32`} />
        <button
          disabled={!dirty}
          onClick={() => onSave(draft)}
          className="text-xs font-semibold text-brand-400 hover:text-brand-300 disabled:opacity-30 transition-colors">
          Save
        </button>
        {row && row.spent_cents > 0 && (
          <span className="text-[11px] text-adm-subtle ml-auto">Spent {fmt(row.spent_cents)}</span>
        )}
      </div>
    </div>
  )
}

function RewardRow({ reward, onToggle, onDelete }: {
  reward: Reward
  onToggle: () => void
  onDelete: () => void
}) {
  const cond = reward.unlock_condition as Record<string, unknown>
  const condLabel =
    cond?.type === 'points'      ? `${cond.min_points} pts` :
    cond?.type === 'achievement' ? `Badge: ${cond.slug}` :
    cond?.type === 'completion'  ? `Completion: ${cond.subject ?? '—'}${cond.grade ? ` g${cond.grade}` : ''}` :
                                   '—'
  return (
    <div className="bg-adm-bg/50 border border-adm-border rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-adm-text">{reward.title}</p>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-adm-muted border border-adm-border rounded px-1.5 py-0.5">
              {reward.reward_type.replace('_', ' ')}
            </span>
            {!reward.is_active && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                Inactive
              </span>
            )}
          </div>
          {reward.description && <p className="text-xs text-adm-muted mt-0.5">{reward.description}</p>}
          <p className="text-[11px] text-adm-subtle mt-1">
            {fmt(reward.value_cents)} · Unlock: {condLabel}
            {reward.max_redemptions != null && ` · ${reward.redemption_count}/${reward.max_redemptions} redeemed`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onToggle} className="text-xs text-adm-muted hover:text-adm-text">{reward.is_active ? 'Deactivate' : 'Activate'}</button>
          <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-300">Delete</button>
        </div>
      </div>
    </div>
  )
}

function NewRewardForm({ onCreate, onCancel }: {
  onCreate: (r: Omit<Reward, 'id' | 'redemption_count'>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<Reward['reward_type']>('free_item')
  const [valueDollars, setValueDollars] = useState('0')
  const [unlockType, setUnlockType] = useState<typeof UNLOCK_TYPES[number]['value']>('points')
  const [unlockValue, setUnlockValue] = useState('500')

  function handleCreate() {
    let unlock_condition: Record<string, unknown> = {}
    if (unlockType === 'points')      unlock_condition = { type: 'points', min_points: Number(unlockValue) || 0 }
    if (unlockType === 'achievement') unlock_condition = { type: 'achievement', slug: unlockValue.trim() }
    if (unlockType === 'completion')  unlock_condition = { type: 'completion', subject: unlockValue.trim() }
    onCreate({
      title: title.trim(),
      description: description.trim() || null,
      reward_type: type,
      value_cents: Math.max(0, Math.round(Number(valueDollars) * 100)),
      max_redemptions: null,
      unlock_condition,
      is_active: true,
      starts_at: null,
      ends_at: null,
    })
  }

  return (
    <div className="bg-adm-bg/50 border border-adm-border rounded-xl px-4 py-4 mb-3 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Title" required>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={160} className={inputClass} />
        </Field>
        <Field label="Reward type">
          <select value={type} onChange={e => setType(e.target.value as Reward['reward_type'])} className={inputClass}>
            {REWARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Value" hint="Dollars (used to debit budget on redemption).">
          <div className="flex items-center gap-2">
            <span className="text-adm-muted text-sm">$</span>
            <input type="number" step="0.01" min="0" value={valueDollars} onChange={e => setValueDollars(e.target.value)} className={`${inputClass} max-w-32`} />
          </div>
        </Field>
        <Field label="Unlock condition">
          <div className="flex items-center gap-2">
            <select value={unlockType} onChange={e => setUnlockType(e.target.value as typeof UNLOCK_TYPES[number]['value'])} className={`${inputClass} max-w-44`}>
              {UNLOCK_TYPES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
            <input
              value={unlockValue}
              onChange={e => setUnlockValue(e.target.value)}
              placeholder={unlockType === 'points' ? '500' : unlockType === 'achievement' ? 'first_quest' : 'math'}
              className={inputClass} />
          </div>
        </Field>
        <div className="md:col-span-2">
          <Field label="Description">
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className={`${inputClass} resize-none`} />
          </Field>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleCreate}
          disabled={!title.trim()}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          Create reward
        </button>
        <button onClick={onCancel} className="text-sm text-adm-muted hover:text-adm-text">Cancel</button>
      </div>
    </div>
  )
}
