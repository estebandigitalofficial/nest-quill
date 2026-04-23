'use client'

import { useState } from 'react'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

const SUBJECTS = [
  'General question',
  'Story problem',
  'Billing or account',
  'Feature request',
  'Other',
]

const inputClass =
  'w-full rounded-lg border border-parchment-dark px-3.5 py-2.5 text-sm text-charcoal bg-white placeholder:text-charcoal-light/40 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors hover:border-oxford/30'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: SUBJECTS[0], message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      setStatus('sent')
    } else {
      const json = await res.json().catch(() => ({}))
      setErrorMsg(json.error ?? 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford">← Back</Link>} />

      <div className="flex-1 overflow-y-auto">
        <main className="max-w-xl mx-auto px-6 py-16 w-full">
          {status === 'sent' ? (
            <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-8 py-12 text-center space-y-4">
              <div className="text-4xl">📬</div>
              <h1 className="font-serif text-2xl text-oxford">Message sent!</h1>
              <p className="text-sm text-charcoal-light max-w-xs mx-auto">
                Thanks for reaching out. We typically reply within one business day.
              </p>
              <button
                onClick={() => { setStatus('idle'); setForm({ name: '', email: '', subject: SUBJECTS[0], message: '' }) }}
                className="text-sm text-brand-600 font-medium hover:text-brand-700"
              >
                Send another message
              </button>
            </div>
          ) : (
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
                      required
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

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-charcoal">Subject</label>
                  <select
                    value={form.subject}
                    onChange={e => set('subject', e.target.value)}
                    className={inputClass}
                  >
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
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
                  <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
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
          )}
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
