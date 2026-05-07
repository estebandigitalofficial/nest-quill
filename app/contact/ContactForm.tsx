'use client'

// Client-side form for /contact. Owns the form state, the success
// state, and the submit fetch. Lives in its own file so the parent
// page can stay a server component and import SiteHeader / SiteFooter
// (which are async server components and would crash if pulled into a
// client bundle via createAdminClient).

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Slug values match the API's VALID_CATEGORIES set exactly. Labels
// can be tweaked freely; values must stay stable so existing tickets
// keep their categorization.
const CATEGORIES: { value: string; label: string }[] = [
  { value: 'story_issue',           label: 'Story issue' },
  { value: 'account_login',         label: 'Account / login' },
  { value: 'classroom_educator',    label: 'Classroom / educator' },
  { value: 'billing_pricing',       label: 'Billing / pricing' },
  { value: 'sponsor_rewards',       label: 'Sponsor / rewards' },
  { value: 'guided_tour_confusion', label: 'Guided tour confusion' },
  { value: 'bug_report',            label: 'Bug report' },
  { value: 'other',                 label: 'Other' },
]

const inputClass =
  'w-full rounded-lg border border-parchment-dark px-3.5 py-2.5 text-sm text-charcoal bg-white placeholder:text-charcoal-light/40 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors hover:border-oxford/30'

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', category: 'other', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [refId, setRefId] = useState<string | null>(null)

  // Prefill name + email when the user is signed in. Best-effort; if the
  // session isn't ready yet, the form simply renders empty.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
      const name = typeof meta.full_name === 'string' ? meta.full_name : ''
      setForm(f => ({
        ...f,
        email: f.email || data.user!.email || '',
        name:  f.name  || name,
      }))
    })
    return () => { cancelled = true }
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (res.ok) {
        const json = await res.json().catch(() => ({}))
        setRefId(json.refId ?? null)
        setStatus('sent')
        return
      }

      const json = await res.json().catch(() => ({}))
      // The API uses { error } for our own validation paths, but the
      // beta-ops gate (gateSupportIntake) returns { message, code }.
      // While we're hardening the contact pipeline we also surface
      // the diagnostic code + the operator recovery hint so production
      // failures are self-describing without DevTools spelunking.
      const baseMsg = json.error ?? json.message ?? 'Something went wrong. Please try again.'
      const codeSuffix = json.code ? ` (code: ${json.code})` : ''
      const recoverySuffix = json.recovery ? `\n\nFix: ${json.recovery}` : ''
      setErrorMsg(baseMsg + codeSuffix + recoverySuffix)
      setStatus('error')
    } catch {
      setErrorMsg("Couldn't reach the server. Check your connection and try again.")
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-8 py-12 text-center space-y-4">
        <h1 className="font-serif text-2xl text-oxford">Message sent!</h1>
        <p className="text-sm text-charcoal-light max-w-xs mx-auto">
          Thanks for reaching out. We typically reply within one business day.
        </p>
        {refId && (
          <p className="text-xs text-charcoal-light">
            Reference: <span className="font-mono text-oxford">#{refId}</span>
          </p>
        )}
        <button
          onClick={() => {
            setStatus('idle')
            setRefId(null)
            setForm(f => ({ ...f, subject: '', message: '' }))
          }}
          className="text-sm text-brand-600 font-medium hover:text-brand-700"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-8 py-10 space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-oxford mb-1">Get in touch</h1>
        <p className="text-charcoal-light text-sm">
          We&apos;d love to hear from you. We typically respond within one business day.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-charcoal">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-charcoal">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-charcoal">Category</label>
            <select
              value={form.category}
              onChange={e => set('category', e.target.value)}
              className={inputClass}
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-charcoal">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={e => set('subject', e.target.value)}
              placeholder="Short summary"
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-charcoal">Message</label>
          <textarea
            required
            rows={5}
            value={form.message}
            onChange={e => set('message', e.target.value)}
            placeholder="Tell us what's on your mind…"
            className={inputClass + ' resize-none'}
          />
        </div>

        {status === 'error' && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {status === 'sending' ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </div>
  )
}
