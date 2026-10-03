'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { appUrl } from '@/lib/utils/appUrl'
import { useLanguage } from '@/lib/i18n/context'
import { authErrorMessage } from '@/lib/i18n/authErrors'

export default function ForgotPasswordPage() {
  const { t } = useLanguage()
  const a = t.auth
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: appUrl('/reset-password'),
    })

    setLoading(false)

    if (error) {
      setError(authErrorMessage(t, error.message))
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 sm:px-8 py-8 sm:py-10 space-y-4 text-center">
          <h1 className="font-serif text-2xl text-gray-900">{a.forgot.sentTitle}</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            {a.forgot.sentBody1} <strong className="text-gray-700 break-all">{email}</strong>.{' '}
            {a.forgot.sentBody2}
          </p>
          <p className="text-xs text-gray-400 pt-2">
            {a.forgot.noMail}{' '}
            <button
              onClick={() => setSubmitted(false)}
              className="text-brand-600 hover:text-brand-700 font-medium"
            >
              {a.forgot.tryAgain}
            </button>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 sm:px-8 py-8 sm:py-10 space-y-6">
        <div>
          <h1 className="font-serif text-2xl text-gray-900">{a.forgot.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{a.forgot.sub}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700" htmlFor="forgot-email">{a.email}</label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder={a.emailPlaceholder}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? a.forgot.submitting : a.forgot.submit}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700">
            {a.forgot.back}
          </Link>
        </p>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors hover:border-gray-300'
