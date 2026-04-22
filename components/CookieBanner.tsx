'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('cookie_consent')) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem('cookie_consent', 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: '#1c1917', borderTop: '1px solid #292524',
      padding: '14px 20px',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <p style={{ fontSize: 13, color: '#a8a29e', lineHeight: 1.5, margin: 0, maxWidth: 620 }}>
        We use cookies to keep you signed in and remember your reading position.{' '}
        <Link href="/privacy" style={{ color: '#C99700', textDecoration: 'underline' }}>
          Privacy Policy
        </Link>
      </p>
      <div style={{ display: 'flex', gap: 8, shrink: 0 } as React.CSSProperties}>
        <button
          onClick={decline}
          style={{ fontSize: 12, fontWeight: 500, padding: '7px 14px', borderRadius: 8, border: '1px solid #44403c', color: '#78716c', background: 'transparent', cursor: 'pointer' }}
        >
          Decline
        </button>
        <button
          onClick={accept}
          style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', color: 'white', background: '#C99700', cursor: 'pointer' }}
        >
          Accept
        </button>
      </div>
    </div>
  )
}
