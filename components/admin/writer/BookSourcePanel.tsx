'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { extractPdfText } from '@/lib/writer/extractPdfText'

type ConvertPreview = {
  confidence: 'high' | 'low'
  warnings: string[]
  chapterCount: number
  chapters: { title: string; wordCount: number; excerpt: string }[]
  droppedPreambleChars: number
}

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
  const [previewing, setPreviewing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [convertPreview, setConvertPreview] = useState<ConvertPreview | null>(null)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [convertResult, setConvertResult] = useState<{ chapterCount: number; sceneCount: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)

    // Extract text in browser — paragraph-aware (preserves paragraph breaks).
    let text = ''
    try {
      text = await extractPdfText(file)
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

  async function handleConvertPreview() {
    setPreviewing(true)
    setConvertError(null)
    setConvertResult(null)
    const res = await fetch(`/api/admin/writer/books/${bookId}/convert-manuscript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commit: false }),
    })
    const json = await res.json()
    if (!res.ok) {
      setConvertError(json.error ?? 'Preview failed')
      setConvertPreview(null)
    } else {
      setConvertPreview(json)
    }
    setPreviewing(false)
  }

  async function handleConvertCommit(mode: 'auto' | 'single') {
    if (!confirm('This will replace any existing chapters and scenes with the imported manuscript text. Your original PDF text is kept, so you can re-import. Continue?')) return
    setCommitting(true)
    setConvertError(null)
    const res = await fetch(`/api/admin/writer/books/${bookId}/convert-manuscript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commit: true, mode }),
    })
    const json = await res.json()
    if (!res.ok) {
      setConvertError(json.error ?? 'Conversion failed')
    } else {
      setConvertResult({ chapterCount: json.chapterCount, sceneCount: json.sceneCount })
      setConvertPreview(null)
      router.refresh()
    }
    setCommitting(false)
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
              className="text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-adm-text px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
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
            fileName ? 'bg-adm-surface hover:bg-adm-border text-adm-muted' : 'bg-brand-500 hover:bg-brand-600 text-adm-text'
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

      {/* Convert to Writer Format — faithful transcription (NOT auto-outline) */}
      {fileName && (
        <div className="border-t border-adm-border px-5 py-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-adm-muted uppercase tracking-widest">Convert to Writer Format</p>
              <p className="text-xs text-adm-subtle mt-0.5">
                {convertResult
                  ? `${convertResult.chapterCount} chapters · ${convertResult.sceneCount} scenes imported`
                  : 'Faithful import — splits your manuscript into chapters keeping the exact text. No AI rewriting.'}
              </p>
            </div>
            <button
              onClick={handleConvertPreview}
              disabled={previewing || committing}
              className="text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-adm-text px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
            >
              {previewing ? 'Scanning…' : convertResult ? 'Re-import' : 'Convert to Writer Format →'}
            </button>
          </div>

          {convertError && <p className="text-xs text-red-400">{convertError}</p>}

          {/* Preview */}
          {convertPreview && (
            <div className="rounded-lg border border-adm-border bg-adm-bg/40 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                    convertPreview.confidence === 'high'
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-amber-500/15 text-amber-400'
                  }`}
                >
                  {convertPreview.confidence === 'high' ? 'Looks good' : 'Low confidence'}
                </span>
                <span className="text-xs text-adm-muted">
                  {convertPreview.chapterCount} chapter{convertPreview.chapterCount === 1 ? '' : 's'} detected
                </span>
              </div>

              {convertPreview.warnings.length > 0 && (
                <ul className="space-y-1">
                  {convertPreview.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-400">⚠ {w}</li>
                  ))}
                </ul>
              )}

              {convertPreview.chapters.length > 0 && (
                <ol className="space-y-1 max-h-48 overflow-y-auto">
                  {convertPreview.chapters.map((c, i) => (
                    <li key={i} className="text-xs text-adm-muted flex items-baseline gap-2">
                      <span className="text-adm-subtle tabular-nums w-5 shrink-0">{i + 1}.</span>
                      <span className="text-adm-text font-medium truncate">{c.title}</span>
                      <span className="text-adm-subtle shrink-0">· {c.wordCount.toLocaleString()} words</span>
                    </li>
                  ))}
                </ol>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {convertPreview.confidence === 'high' && convertPreview.chapterCount > 0 && (
                  <button
                    onClick={() => handleConvertCommit('auto')}
                    disabled={committing}
                    className="text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-adm-text px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {committing ? 'Importing…' : `Create ${convertPreview.chapterCount} chapters`}
                  </button>
                )}
                <button
                  onClick={() => handleConvertCommit('single')}
                  disabled={committing}
                  className="text-xs font-semibold bg-adm-surface hover:bg-adm-border text-adm-muted px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  Import as one chapter
                </button>
                <button
                  onClick={() => setConvertPreview(null)}
                  disabled={committing}
                  className="text-xs font-semibold text-adm-subtle hover:text-adm-muted px-2 py-1.5 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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
