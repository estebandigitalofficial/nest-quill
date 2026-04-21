'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WriterBook, WriterChapterWithScenes, WriterScene } from '@/types/writer'
import { cn } from '@/lib/utils/cn'

export default function ChapterEditor({
  book,
  chapter,
}: {
  book: WriterBook
  chapter: WriterChapterWithScenes
}) {
  const router = useRouter()
  const [scenes, setScenes] = useState<WriterScene[]>(chapter.scenes)
  const [addingScene, setAddingScene] = useState(false)
  const [newSceneBrief, setNewSceneBrief] = useState('')
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [mode, setMode] = useState<'preserve_voice' | 'rewrite_free'>('preserve_voice')
  const [notes, setNotes] = useState(chapter.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesOpen, setNotesOpen] = useState(!!chapter.notes)
  const [preflight, setPreflight] = useState<{ sceneId: string; issues: string[] } | null>(null)

  const totalWords = scenes.reduce((sum, s) => sum + (s.word_count ?? 0), 0)

  async function addScene() {
    if (!newSceneBrief.trim()) return
    const nextNumber = scenes.length + 1

    const res = await fetch(
      `/api/admin/writer/books/${book.id}/chapters/${chapter.id}/scenes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene_number: nextNumber, brief: newSceneBrief }),
      }
    )

    if (res.ok) {
      const scene = await res.json()
      setScenes(s => [...s, scene])
      setNewSceneBrief('')
      setAddingScene(false)
    }
  }

  async function generateScene(scene: WriterScene) {
    setGeneratingId(scene.id)

    const res = await fetch(
      `/api/admin/writer/books/${book.id}/chapters/${chapter.id}/scenes/${scene.id}/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, chapterNotes: notes }),
      }
    )

    if (res.ok) {
      setPreflight(null)
      router.refresh()
      setScenes(prev =>
        prev.map(s => s.id === scene.id ? { ...s, status: 'draft' as const } : s)
      )
    } else if (res.status === 422) {
      const json = await res.json()
      setPreflight({ sceneId: scene.id, issues: json.issues ?? [] })
      setNotesOpen(true)
    } else {
      const json = await res.json()
      alert(`Generation failed: ${json.error}`)
    }

    setGeneratingId(null)
    router.refresh()
  }

  function startEdit(scene: WriterScene) {
    setEditingId(scene.id)
    setEditContent(scene.content ?? '')
  }

  async function saveEdit(scene: WriterScene) {
    setSavingEdit(true)
    const wordCount = editContent.trim().split(/\s+/).length

    const res = await fetch(
      `/api/admin/writer/books/${book.id}/chapters/${chapter.id}/scenes`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scene.id, content: editContent, word_count: wordCount, status: 'draft' }),
      }
    )

    if (res.ok) {
      setScenes(prev =>
        prev.map(s => s.id === scene.id ? { ...s, content: editContent, word_count: wordCount } : s)
      )
      setEditingId(null)
    }
    setSavingEdit(false)
  }

  async function saveNotes() {
    setSavingNotes(true)
    await fetch(
      `/api/admin/writer/books/${book.id}/chapters/${chapter.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      }
    )
    setSavingNotes(false)
  }

  async function deleteScene(sceneId: string) {
    if (!confirm('Delete this scene?')) return
    setScenes(prev => prev.filter(s => s.id !== sceneId))
    // TODO: add DELETE route for scenes
  }

  return (
    <div className="space-y-6">
      {/* Chapter header */}
      <div className="space-y-1">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Chapter {chapter.chapter_number}</p>
        <h1 className="font-serif text-2xl text-white">{chapter.title}</h1>
        <p className="text-sm text-gray-500">{chapter.brief}</p>
        <p className="text-xs text-gray-600 pt-1">
          {scenes.length} scenes · {totalWords.toLocaleString()} words written
        </p>
        {/* Mode toggle */}
        <div className="flex items-center gap-1 pt-2">
          <button
            onClick={() => setMode('preserve_voice')}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${mode === 'preserve_voice' ? 'border-brand-500 text-brand-400 bg-brand-500/10' : 'border-gray-700 text-gray-600 hover:border-gray-500'}`}
          >
            Preserve voice
          </button>
          <button
            onClick={() => setMode('rewrite_free')}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${mode === 'rewrite_free' ? 'border-brand-500 text-brand-400 bg-brand-500/10' : 'border-gray-700 text-gray-600 hover:border-gray-500'}`}
          >
            Rewrite freely
          </button>
        </div>
      </div>

      {/* Correction notes */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setNotesOpen(o => !o)}
          className="w-full px-5 py-3 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Correction Notes</span>
            {notes && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 inline-block" />}
          </div>
          <span className="text-xs text-gray-600">{notesOpen ? '▲' : '▼'}</span>
        </button>

        {notesOpen && (
          <div className="border-t border-gray-800 px-5 py-4 space-y-3">
            {preflight && (
              <div className="bg-yellow-950 border border-yellow-700 rounded-lg px-4 py-3 space-y-2">
                <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Generation blocked — possible fabrication</p>
                <ul className="space-y-1">
                  {preflight.issues.map((issue, i) => (
                    <li key={i} className="text-xs text-yellow-300">• {issue}</li>
                  ))}
                </ul>
                <p className="text-xs text-yellow-600">Add correction notes below to address these, then try generating again.</p>
              </div>
            )}
            <p className="text-xs text-gray-500">Tell the AI what to correct or avoid in this chapter — facts it got wrong, people who weren't there, details it invented.</p>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              rows={4}
              placeholder="e.g. My daughter was not present in this chapter. The conversation happened at home, not at a restaurant. Do not mention the neighbor."
              value={notes}
              onChange={e => { setNotes(e.target.value); setPreflight(null) }}
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {savingNotes ? 'Saving…' : 'Save notes'}
            </button>
            <p className="text-xs text-gray-600">These notes are included every time you generate a scene in this chapter.</p>
          </div>
        )}
      </div>

      {/* Scenes */}
      <div className="space-y-4">
        {scenes.map((scene, idx) => (
          <div key={scene.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {/* Scene header */}
            <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Scene {idx + 1}</span>
                <p className="text-xs text-gray-500 mt-0.5">{scene.brief}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {scene.word_count && (
                  <span className="text-xs text-gray-600">{scene.word_count.toLocaleString()}w</span>
                )}
                {editingId === scene.id ? (
                  <>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveEdit(scene)}
                      disabled={savingEdit}
                      className="text-xs bg-green-700 hover:bg-green-600 text-white font-semibold px-3 py-1 rounded-lg transition-colors"
                    >
                      {savingEdit ? 'Saving…' : 'Save'}
                    </button>
                  </>
                ) : (
                  <>
                    {scene.content && (
                      <button
                        onClick={() => startEdit(scene)}
                        className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded transition-colors"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => generateScene(scene)}
                      disabled={generatingId === scene.id}
                      className={cn(
                        'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
                        scene.content
                          ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                          : 'bg-brand-500 hover:bg-brand-600 text-white',
                        generatingId === scene.id && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {generatingId === scene.id
                        ? 'Writing…'
                        : scene.content
                        ? 'Regenerate'
                        : 'Generate →'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Scene content */}
            <div className="px-5 py-4">
              {generatingId === scene.id ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                  <span className="w-4 h-4 border-2 border-brand-700 border-t-brand-400 rounded-full animate-spin" />
                  Writing scene…
                </div>
              ) : editingId === scene.id ? (
                <textarea
                  autoFocus
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-sm text-gray-100 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  rows={Math.max(8, editContent.split('\n').length + 2)}
                />
              ) : scene.content ? (
                <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-serif">
                  {scene.content}
                </div>
              ) : (
                <p className="text-sm text-gray-600 italic py-2">
                  Not written yet. Click Generate to write this scene.
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Add scene */}
        {addingScene ? (
          <div className="bg-gray-900 border border-brand-700 rounded-xl px-5 py-4 space-y-3">
            <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest">Scene {scenes.length + 1}</p>
            <textarea
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              rows={2}
              placeholder="What happens in this scene? (brief — guides the AI)"
              value={newSceneBrief}
              onChange={e => setNewSceneBrief(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setAddingScene(false); setNewSceneBrief('') }}
                className="flex-1 text-sm text-gray-500 py-2 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addScene}
                disabled={!newSceneBrief.trim()}
                className="flex-1 text-sm bg-brand-500 hover:bg-brand-600 disabled:bg-brand-900 text-white font-semibold py-2 rounded-lg transition-colors"
              >
                Add scene
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingScene(true)}
            className="w-full border border-dashed border-gray-700 hover:border-gray-500 text-gray-600 hover:text-gray-400 text-sm py-3 rounded-xl transition-colors"
          >
            + Add scene
          </button>
        )}
      </div>
    </div>
  )
}
