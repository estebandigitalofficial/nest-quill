'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const inputClass = 'w-full text-sm bg-adm-bg border border-adm-border rounded-lg px-3 py-2 text-adm-text focus:outline-none focus:ring-1 focus:ring-brand-500'

export default function NewSponsorForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [description, setDescription] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [budgetDollars, setBudgetDollars] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await fetch('/api/admin/sponsors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        logo_url: logoUrl.trim() || undefined,
        description: description.trim() || undefined,
        contact_name: contactName.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        total_budget_cents: Math.max(0, Math.round(Number(budgetDollars) * 100)),
        is_active: true,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Failed to save.'); return }
    router.push(`/admin/sponsors/${data.sponsor.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-adm-surface border border-adm-border rounded-xl p-6 space-y-4">
      <Field label="Name" required>
        <input value={name} onChange={e => setName(e.target.value)} required maxLength={120} className={inputClass} />
      </Field>
      <Field label="Logo URL" hint="Optional. Paste a hosted image URL.">
        <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://…" className={`${inputClass} font-mono text-xs`} />
      </Field>
      <Field label="Description" hint="Short summary shown in admin lists.">
        <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className={`${inputClass} resize-none`} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Contact name">
          <input value={contactName} onChange={e => setContactName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Contact email">
          <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="Total budget" hint="Dollars. You'll allocate this to rewards/prizes/etc. on the next screen.">
        <div className="flex items-center gap-2">
          <span className="text-adm-muted text-sm">$</span>
          <input type="number" step="0.01" min="0" value={budgetDollars} onChange={e => setBudgetDollars(e.target.value)} className={`${inputClass} max-w-32`} />
        </div>
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          {saving ? 'Saving…' : 'Create sponsor'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-adm-muted uppercase tracking-widest">
        {label}{required && <span className="text-brand-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-adm-subtle">{hint}</p>}
    </div>
  )
}
