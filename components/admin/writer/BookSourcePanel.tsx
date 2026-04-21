'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function BookSourcePanel({
  bookId,
  initialFileName,
  initialWordCount,
  needsMetadata,
}: {
  bookId: string
  initialFileName: string | null
  initialWordCount: number | null
  needsMetadata?: boolean
}) {
  const router = useRouter()
  const [fileName, setFileName] = useState(initialFileName)
  const [wordCount, setWordCount] = useState(initialWordCount)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeStatus, setAnalyzeStatus] = useState<'idle' | 'done' | 'error'>(needsMetadata ? 'idle' : 'done')
  const [reviewing, setReviewing] = useState(false)
  const [review, setReview] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)

    const form = new FormData()
    form.append('pdf', file)

    const res = await fetch(`/api/admin/writer/books/${bookId}/upload-pdf`, {
      method: 'POST',
      body: form,
    })

    const json = await res.json()

    if (!res.ok) {
      setUploadError(json.error ?? 'Upload failed')
    } else {
      setFileName(json.fileName)
      setWordCount(json.wordCount)
      setReview(null)
      setAnalyzeStatus('idle')
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleAnalyze() {
    setAnalyzing(true)
    setAnalyzeStatus('idle')

    const res = await fetch(`/api/admin/writer/books/${bookId}/analyze`, { method: 'POST' })
    const json = await res.json()

    if (!res.ok) {
      setAnalyzeStatus('error')
    } else {
      setAnalyzeStatus('done')
      // Refresh page so book header shows updated title/genre/premise
      router.refresh()
    }
    setAnalyzing(false)
  }

  async function handleReview() {
    setReviewing(true)
    setReview(null)
    setReviewOpen(true)

    const res = await fetch(`/api/admin/writer/books/${bookId}/review`, { method: 'POST' })
    const json = await res.json()

    setReview(res.ok ? json.review : `Error: ${json.error}`)
    setReviewing(false)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Source Manuscript</p>
          {fileName ? (
            <p className="text-sm text-gray-300 mt-0.5">
              {fileName}
              {wordCount && <span className="text-gray-600 ml-2">· {wordCount.toLocaleString()} words</span>}
            </p>
          ) : (
            <p className="text-sm text-gray-600 mt-0.5">No manuscript uploaded yet</p>
          )}
          {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {fileName && analyzeStatus !== 'done' && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {analyzing ? 'Analyzing…' : 'Analyze →'}
            </button>
          )}
          {fileName && analyzeStatus === 'done' && (
            <button
              onClick={handleReview}
              disabled={reviewing}
              className="text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {reviewing ? 'Reviewing…' : 'Review →'}
            </button>
          )}
          <label className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
            fileName ? 'bg-gray-800 hover:bg-gray-700 text-gray-400' : 'bg-brand-500 hover:bg-brand-600 text-white'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? 'Uploading…' : fileName ? 'Replace PDF' : 'Upload PDF'}
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      </div>

      {/* Analyze prompt banner */}
      {fileName && analyzeStatus === 'idle' && !analyzing && (
        <div className="border-t border-gray-800 px-5 py-3 flex items-center justify-between gap-4">
          <p className="text-xs text-gray-500">Click <span className="text-brand-400 font-semibold">Analyze →</span> to fill in title, genre, tone, and premise from the manuscript.</p>
        </div>
      )}

      {/* Review output */}
      {reviewOpen && (
        <div className="border-t border-gray-800">
          <div className="px-5 py-3 flex items-center justify-between">
            <p className="text-xs font-bold text-brand-400 uppercase tracking-widest">Editorial Review</p>
            <button onClick={() => setReviewOpen(false)} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">✕</button>
          </div>
          <div className="px-5 pb-5">
            {reviewing ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                <span className="w-4 h-4 border-2 border-brand-700 border-t-brand-400 rounded-full animate-spin" />
                Analyzing manuscript…
              </div>
            ) : (
              <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{review}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
