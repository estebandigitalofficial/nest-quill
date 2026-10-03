'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/context'
import { authErrorMessage } from '@/lib/i18n/authErrors'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const a = t.auth
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // When arriving via the server-side callback (token_hash flow), the recovery
    // session is already stored in the cookie — getSession() picks it up
    // immediately without needing a PASSWORD_RECOVERY event.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    // Fallback: listen for PASSWORD_RECOVERY for any client-side exchange path
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    // Handle ?code= directly in URL (PKCE direct-to-page fallback)
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).catch(() => {
        setError(a.reset.invalid)
      })
    }

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError(a.reset.mismatch)
      return
    }
    if (password.length < 8) {
      setError(a.reset.short)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(authErrorMessage(t, error.message))
      return
    }

    router.push('/account')
    router.refresh()
  }

  if (!ready) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 sm:px-8 py-8 sm:py-10 text-center space-y-3">
          {error ? (
            <>
              <p className="text-sm text-red-500">{error}</p>
              <a href="/forgot-password" className="text-sm text-brand-600 font-medium hover:text-brand-700">
                {a.reset.requestNew}
              </a>
            </>
          ) : (
            <p className="text-sm text-gray-500">{a.reset.verifying}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 sm:px-8 py-8 sm:py-10 space-y-6">
        <div>
          <h1 className="font-serif text-2xl text-gray-900">{a.reset.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{a.reset.sub}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700" htmlFor="reset-password">{a.reset.newPassword}</label>
            <input
              id="reset-password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder={a.signup.passwordPlaceholder}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700" htmlFor="reset-confirm">{a.reset.confirmPassword}</label>
            <input
              id="reset-confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              placeholder={a.reset.confirmPlaceholder}
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
            {loading ? a.reset.submitting : a.reset.submit}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 bg-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors hover:border-gray-300'
