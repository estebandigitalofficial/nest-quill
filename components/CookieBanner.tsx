'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    try {
      if (!localStorage.getItem('cookie_consent')) setVisible(true)
    } catch { /* storage unavailable: stay hidden */ }
  }, [])

  function remember(value: 'accepted' | 'declined') {
    try { localStorage.setItem('cookie_consent', value) } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    // Sits above the mobile tab bar (56px + safe area) and at the bottom on desktop.
    <div
      role="dialog"
      aria-label={t.cookie.policy}
      className="fixed inset-x-0 z-[60] bottom-[calc(56px+env(safe-area-inset-bottom))] md:bottom-0"
      style={{
        background: '#1c1917', borderTop: '1px solid #292524',
        padding: '12px 16px',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
      <p style={{ fontSize: 13, color: '#a8a29e', lineHeight: 1.5, margin: 0, maxWidth: 620 }}>
        {t.cookie.text}{' '}
        <Link href="/privacy" style={{ color: '#C99700', textDecoration: 'underline' }}>
          {t.cookie.policy}
        </Link>
      </p>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => remember('declined')}
          style={{ fontSize: 12, fontWeight: 500, padding: '8px 14px', borderRadius: 8, border: '1px solid #44403c', color: '#a8a29e', background: 'transparent', cursor: 'pointer' }}
        >
          {t.cookie.decline}
        </button>
        <button
          onClick={() => remember('accepted')}
          style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', color: 'white', background: '#C99700', cursor: 'pointer' }}
        >
          {t.cookie.accept}
        </button>
      </div>
    </div>
  )
}
