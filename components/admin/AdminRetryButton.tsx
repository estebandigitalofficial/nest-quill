'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminRetryButton({ requestId }: { requestId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const router = useRouter()

  async function handleRetry() {
    setState('loading')
    const res = await fetch(`/api/story/${requestId}/retry`, { method: 'POST' })
    if (res.ok) {
      setState('done')
      setTimeout(() => {
        router.refresh()
        setState('idle')
      }, 1500)
    } else {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  if (state === 'done') return <span className="text-xs text-green-400 font-medium">Queued ✓</span>
  if (state === 'error') return <span className="text-xs text-red-400 font-medium">Failed</span>

  return (
    <button
      onClick={handleRetry}
      disabled={state === 'loading'}
      className="text-xs text-amber-400 hover:text-amber-300 font-medium disabled:opacity-50 transition-colors"
    >
      {state === 'loading' ? 'Retrying…' : 'Retry'}
    </button>
  )
}
