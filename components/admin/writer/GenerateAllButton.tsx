'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Mode = 'preserve_voice' | 'rewrite_free'

export default function GenerateAllButton({ bookId }: { bookId: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('preserve_voice')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerateAll() {
    if (!confirm('This will generate all scenes. Existing scene content will be overwritten. Continue?')) return

    setRunning(true)
    setError(null)

    const bookRes = await fetch(`/api/admin/writer/books/${bookId}`)
    const book = await bookRes.json()

    type SceneJob = { chapterId: string; sceneId: string }
    const jobs: SceneJob[] = []

    for (const chapter of (book.chapters ?? [])) {
      for (const scene of (chapter.scenes ?? [])) {
        jobs.push({ chapterId: chapter.id, sceneId: scene.id })
      }
    }

    if (jobs.length === 0) {
      setError('No scenes found. Run Auto-outline first.')
      setRunning(false)
      return
    }

    setProgress({ done: 0, total: jobs.length })

    for (let i = 0; i < jobs.length; i++) {
      const { chapterId, sceneId } = jobs[i]
      try {
        await fetch(
          `/api/admin/writer/books/${bookId}/chapters/${chapterId}/scenes/${sceneId}/generate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode }),
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
