'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Mode = 'preserve_voice' | 'rewrite_free'

export default function GenerateAllButton({
  bookId,
  savedInstructions,
}: {
  bookId: string
  savedInstructions?: string | null
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('preserve_voice')
  const [instructions, setInstructions] = useState(savedInstructions ?? '')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingInstructions, setSavingInstructions] = useState(false)
  const [instructionsSaved, setInstructionsSaved] = useState(false)

  async function saveInstructions() {
    setSavingInstructions(true)
    await fetch(`/api/admin/writer/books/${bookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructions }),
    })
    setSavingInstructions(false)
    setInstructionsSaved(true)
    setTimeout(() => setInstructionsSaved(false), 2000)
  }

  async function handleGenerateAll() {
    if (!confirm('This will generate all scenes. Existing scene content will be overwritten. Continue?')) return

    // Save instructions to book first so they persist and are available to generate route
    if (instructions.trim()) {
      await fetch(`/api/admin/writer/books/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions }),
      })
    }

    setRunning(true)
    setError(null)

    const bookRes = await fetch(`/api/admin/writer/books/${bookId}`)
    const book = await bookRes.json()

    type SceneJob = { chapterId: string; sceneId: string; chapterNotes?: string }
    const jobs: SceneJob[] = []

    for (const chapter of (book.chapters ?? [])) {
      for (const scene of (chapter.scenes ?? [])) {
        jobs.push({ chapterId: chapter.id, sceneId: scene.id, chapterNotes: chapter.notes ?? '' })
      }
    }

    if (jobs.length === 0) {
      setError('No scenes found. Run Auto-outline first.')
      setRunning(false)
      return
    }

    setProgress({ done: 0, total: jobs.length })

    for (let i = 0; i < jobs.length; i++) {
      const { chapterId, sceneId, chapterNotes } = jobs[i]
      try {
        await fetch(
          `/api/admin/writer/books/${bookId}/chapters/${chapterId}/scenes/${sceneId}/generate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, chapterNotes }),
          }
        )
      } catch { /* continue on individual failure */ }
      setProgress({ done: i + 1, total: jobs.length })
    }

    setRunning(false)
    router.refresh()
  }

  if (running && progress) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 border-2 border-brand-700 border-t-brand-400 rounded-full animate-spin shrink-0" />
          <p className="text-sm text-gray-300">
            Writing scenes… <span className="text-white font-semibold">{progress.done}/{progress.total}</span>
          </p>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-300"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 space-y-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Generate All Scenes</p>

      {/* Writing instructions */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 font-medium">Writing instructions</label>
        <textarea
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
          rows={3}
          placeholder="e.g. Write in first person, casual and conversational — like I'm telling this story to a close friend. Keep my natural voice. Don't make it sound like a published novel."
          value={instructions}
          onChange={e => { setInstructions(e.target.value); setInstructionsSaved(false) }}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600">These instructions are sent to every scene generation for this book.</p>
          <button
            onClick={saveInstructions}
            disabled={savingInstructions || !instructions.trim()}
            className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            {savingInstructions ? 'Saving…' : instructionsSaved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode('preserve_voice')}
          className={`px-3 py-3 rounded-xl border text-left transition-colors space-y-0.5 ${
            mode === 'preserve_voice'
              ? 'border-brand-500 bg-brand-500/10'
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <p className={`text-sm font-semibold ${mode === 'preserve_voice' ? 'text-brand-400' : 'text-gray-300'}`}>
            Preserve my voice
          </p>
          <p className="text-xs text-gray-500">Keeps your tone, rhythm, and style — improves structure and flow</p>
        </button>

        <button
          onClick={() => setMode('rewrite_free')}
          className={`px-3 py-3 rounded-xl border text-left transition-colors space-y-0.5 ${
            mode === 'rewrite_free'
              ? 'border-brand-500 bg-brand-500/10'
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <p className={`text-sm font-semibold ${mode === 'rewrite_free' ? 'text-brand-400' : 'text-gray-300'}`}>
            Rewrite freely
          </p>
          <p className="text-xs text-gray-500">AI takes creative control — may diverge from your original style</p>
        </button>
      </div>

      <button
        onClick={handleGenerateAll}
        className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
      >
        Generate all scenes →
      </button>

      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
    </div>
  )
}
