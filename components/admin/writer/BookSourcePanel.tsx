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
  const [outlining, setOutlining] = useState(false)
  const [outlineStatus, setOutlineStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const [outlineResult, setOutlineResult] = useState<{ chapterCount: number; sceneCount: number } | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [review, setReview] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)

    // Extract text in browser
    let text = ''
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map((item: unknown) => ('str' in (item as object) ? (item as { str: string }).str : '')).join(' ') + '\n'
      }
      text = text.trim()
    } catch (err) {
      setUploadError(`Could not read PDF: ${err instanceof Error ? err.message : String(err)}`)
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    const res = await fetch(`/api/admin/writer/books/${bookId}/upload-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fileName: file.name }),
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

  async function handleAutoOutline() {
    if (!confirm('This will replace any existing chapters and scenes with an AI-generated outline from your manuscript. Continue?')) return
    setOutlining(true)
    setOutlineStatus('idle')

    const res = await fetch(`/api/admin/writer/books/${bookId}/auto-outline`, { method: 'POST' })
    const json = await res.json()

    if (!res.ok) {
      setOutlineStatus('error')
    } else {
      setOutlineStatus('done')
      setOutlineResult({ chapterCount: json.chapterCount, sceneCount: json.sceneCount })
      router.refresh()
    }
    setOutlining(false)
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
    <div className="bg-adm-surface border border-adm-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-adm-muted uppercase tracking-widest">Source Manuscript</p>
          {fileName ? (
            <p className="text-sm text-adm-muted mt-0.5">
              {fileName}
              {wordCount && <span className="text-adm-subtle ml-2">· {wordCount.toLocaleString()} words</span>}
            </p>
          ) : (
            <p className="text-sm text-adm-subtle mt-0.5">No manuscript uploaded yet</p>
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
              className="text-xs font-semibold bg-adm-surface hover:bg-adm-border text-adm-muted px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {reviewing ? 'Reviewing…' : 'Review →'}
            </button>
          )}
          <label className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
            fileName ? 'bg-adm-surface hover:bg-adm-border text-adm-muted' : 'bg-brand-500 hover:bg-brand-600 text-white'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? 'Uploading…' : fileName ? 'Replace PDF' : 'Upload PDF'}
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      </div>

      {/* Analyze prompt banner */}
      {fileName && analyzeStatus === 'idle' && !analyzing && (
        <div className="border-t border-adm-border px-5 py-3">
          <p className="text-xs text-adm-muted">Click <span className="text-brand-400 font-semibold">Analyze →</span> to fill in title, genre, tone, and premise from the manuscript.</p>
        </div>
      )}

      {/* Auto-outline */}
      {fileName && (
        <div className="border-t border-adm-border px-5 py-4 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-adm-muted uppercase tracking-widest">Auto-outline</p>
              <p className="text-xs text-adm-subtle mt-0.5">
                {outlineStatus === 'done' && outlineResult
                  ? `${outlineResult.chapterCount} chapters · ${outlineResult.sceneCount} scenes created`
                  : 'AI reads your manuscript and creates an improved chapter/scene structure'}
              </p>
            </div>
            <button
              onClick={handleAutoOutline}
              disabled={outlining}
              className="text-xs font-semibold bg-adm-surface hover:bg-adm-border text-adm-muted px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
            >
              {outlining ? 'Outlining…' : outlineStatus === 'done' ? 'Re-outline' : 'Auto-outline →'}
            </button>
          </div>
          {outlineStatus === 'error' && <p className="text-xs text-red-400">Outline failed — try again</p>}
        </div>
      )}

      {/* Review output */}
      {reviewOpen && (
        <div className="border-t border-adm-border">
          <div className="px-5 py-3 flex items-center justify-between">
            <p className="text-xs font-bold text-brand-400 uppercase tracking-widest">Editorial Review</p>
            <button onClick={() => setReviewOpen(false)} className="text-xs text-adm-subtle hover:text-adm-muted transition-colors">✕</button>
          </div>
          <div className="px-5 pb-5">
            {reviewing ? (
              <div className="flex items-center gap-2 text-sm text-adm-muted py-4">
                <span className="w-4 h-4 border-2 border-brand-700 border-t-brand-400 rounded-full animate-spin" />
                Analyzing manuscript…
              </div>
            ) : (
              <div className="text-sm text-adm-muted leading-relaxed whitespace-pre-wrap">{review}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
