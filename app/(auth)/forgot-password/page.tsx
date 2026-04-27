'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
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
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 space-y-4 text-center">
          <p className="text-3xl">📬</p>
          <h1 className="font-serif text-2xl text-gray-900">Check your email</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            We sent a password reset link to <strong className="text-gray-700">{email}</strong>.
            Check your inbox and follow the link to set a new password.
          </p>
          <p className="text-xs text-gray-400 pt-2">
            Didn&apos;t get it? Check your spam folder or{' '}
            <button
              onClick={() => setSubmitted(false)}
              className="text-brand-600 hover:text-brand-700 font-medium"
            >
              try again
            </button>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 space-y-6">
        <div>
          <h1 className="font-serif text-2xl text-gray-900">Reset your password</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
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
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors hover:border-gray-300'
