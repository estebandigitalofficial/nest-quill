'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  requestId: string
  status: string
}

const REQUEUEABLE = ['generating_text', 'generating_images', 'assembling_pdf', 'queued', 'failed', 'complete']

export default function AdminStoryActions({ requestId, status }: Props) {
  const router = useRouter()
  const [requeue, setRequeue] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [resend, setResend] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleRequeue() {
    setRequeue('loading')
    const endpoint = status === 'failed' ? 'retry' : 'force-requeue'
    const res = await fetch(`/api/story/${requestId}/${endpoint}`, { method: 'POST' })
    if (res.ok) {
      setRequeue('done')
      setTimeout(() => { router.refresh(); setRequeue('idle') }, 1500)
    } else {
      setRequeue('error')
      setTimeout(() => setRequeue('idle'), 3000)
    }
  }

  async function handleResend() {
    setResend('loading')
    const res = await fetch(`/api/admin/stories/${requestId}/resend-email`, { method: 'POST' })
    if (res.ok) {
      setResend('done')
      setTimeout(() => setResend('idle'), 3000)
    } else {
      setResend('error')
      setTimeout(() => setResend('idle'), 3000)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {REQUEUEABLE.includes(status) && (
        <button
          onClick={handleRequeue}
          disabled={requeue === 'loading'}
          className="text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
        >
          {requeue === 'loading' ? 'Requeueing…' : requeue === 'done' ? 'Queued ✓' : requeue === 'error' ? 'Failed' : status === 'failed' ? 'Retry' : 'Force requeue'}
        </button>
      )}
      {status === 'complete' && (
        <button
          onClick={handleResend}
          disabled={resend === 'loading'}
          className="text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
        >
          {resend === 'loading' ? 'Sending…' : resend === 'done' ? 'Email sent ✓' : resend === 'error' ? 'Failed' : 'Re-send email'}
        </button>
      )}
    </div>
  )
}
