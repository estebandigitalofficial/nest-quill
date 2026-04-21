'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GenerateAllButton({ bookId }: { bookId: string }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerateAll() {
    if (!confirm('This will generate all scenes using your manuscript as reference. Existing scene content will be overwritten. Continue?')) return

    setRunning(true)
    setError(null)

    // Fetch current book structure
    const bookRes = await fetch(`/api/admin/writer/books/${bookId}`)
    const book = await bookRes.json()

    type SceneJob = { bookId: string; chapterId: string; sceneId: string }
    const jobs: SceneJob[] = []

    for (const chapter of (book.chapters ?? [])) {
      for (const scene of (chapter.scenes ?? [])) {
        jobs.push({ bookId, chapterId: chapter.id, sceneId: scene.id })
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
          { method: 'POST' }
        )
      } catch {
        // Continue on individual scene failure
      }
      setProgress({ done: i + 1, total: jobs.length })
    }

    setRunning(false)
    router.refresh()
  }

  if (running && progress) {
    return (
      <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
        <span className="w-4 h-4 border-2 border-brand-700 border-t-brand-400 rounded-full animate-spin shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-gray-300">Writing scenes… {progress.done}/{progress.total}</p>
          <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-300"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleGenerateAll}
        className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
      >
        Generate all scenes →
      </button>
      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      <p className="text-xs text-gray-600 text-center">Writes every scene using your manuscript as source material</p>
    </div>
  )
}
