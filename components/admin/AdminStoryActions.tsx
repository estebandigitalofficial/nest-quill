'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  requestId: string
  status: string
  /** Total scenes for this story; used to enable "Generate illustrations". */
  totalScenes?: number
  /** How many scenes still lack a usable image_status='complete' row. */
  missingImages?: number
}

const REQUEUEABLE = ['generating_text', 'generating_images', 'assembling_pdf', 'queued', 'failed', 'complete']

export default function AdminStoryActions({ requestId, status, totalScenes, missingImages }: Props) {
  const router = useRouter()
  const [requeue, setRequeue] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [resend, setResend] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [genImg, setGenImg] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [genImgMsg, setGenImgMsg] = useState<string | null>(null)

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

  async function handleGenerateImages() {
    setGenImg('loading')
    setGenImgMsg(null)
    const res = await fetch(`/api/admin/stories/${requestId}/generate-images`, { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    if (res.ok) {
      setGenImg('done')
      const generated = body.generated ?? 0
      const failed = body.failed ?? 0
      setGenImgMsg(`Generated ${generated}${failed ? ` · ${failed} failed` : ''}`)
      setTimeout(() => { router.refresh(); setGenImg('idle'); setGenImgMsg(null) }, 2000)
    } else {
      setGenImg('error')
      setGenImgMsg(body.message ?? 'Failed')
      setTimeout(() => { setGenImg('idle'); setGenImgMsg(null) }, 4000)
    }
  }

  const canBackfillImages =
    status === 'complete' && (missingImages ?? 0) > 0 && (totalScenes ?? 0) > 0

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
      {canBackfillImages && (
        <button
          onClick={handleGenerateImages}
          disabled={genImg === 'loading'}
          className="text-xs bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
          title="Generate DALL·E illustrations only for scenes that don't have an image yet."
        >
          {genImg === 'loading' ? 'Generating…' :
           genImg === 'done' ? (genImgMsg ?? 'Done ✓') :
           genImg === 'error' ? (genImgMsg ?? 'Failed') :
           `Generate illustrations (${missingImages}/${totalScenes})`}
        </button>
      )}
    </div>
  )
}
