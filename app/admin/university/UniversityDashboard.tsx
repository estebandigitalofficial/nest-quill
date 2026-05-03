'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface ContentItem {
  id: string
  tool_type: string
  grade: number | null
  subject: string | null
  topic: string
  title: string
  content: Record<string, unknown>
  tags: string[]
  source: string
  quality: string
  difficulty: string | null
  use_count: number
  avg_score: number | null
  total_attempts: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Stats {
  totalContent: number
  quizzes: number
  flashcards: number
  studyGuides: number
  courses: number
  units: number
  lessons: number
}

const TOOL_TYPES = ['quiz', 'flashcards', 'study-guide', 'explain', 'reading', 'spelling', 'math']
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8]
const SUBJECTS = ['Math', 'Science', 'English', 'History', 'Social Studies', 'Reading', 'Spelling', 'Geography', 'Vocabulary', 'Grammar']
const QUALITY_LEVELS = ['auto', 'reviewed', 'approved', 'featured']

const TOOL_LABELS: Record<string, string> = {
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  'study-guide': 'Study Guide',
  explain: 'Explainer',
  reading: 'Reading',
  spelling: 'Spelling',
  math: 'Math',
}

const QUALITY_COLORS: Record<string, string> = {
  auto: 'bg-gray-100 text-gray-600',
  reviewed: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  featured: 'bg-amber-100 text-amber-700',
}

export default function UniversityDashboard() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  // Filters
  const [filterTool, setFilterTool] = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterQuality, setFilterQuality] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Edit modal
  const [editItem, setEditItem] = useState<ContentItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editQuality, setEditQuality] = useState('')
  const [editGrade, setEditGrade] = useState<number | ''>('')
  const [editSubject, setEditSubject] = useState('')
  const [saving, setSaving] = useState(false)

  // View modal
  const [viewItem, setViewItem] = useState<ContentItem | null>(null)

  // Batch generation
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<{ generated: number; total: number; errors?: string[] } | null>(null)

  async function handleBatchGenerate(toolType?: string) {
    setGenerating(true)
    setGenResult(null)
    const res = await fetch('/api/admin/university/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolType, limit: 10 }),
    })
    const data = await res.json()
    setGenResult(data)
    setGenerating(false)
    fetchData()
  }

  async function handleGenerateOne(id: string) {
    setGenerating(true)
    await fetch('/api/admin/university/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setGenerating(false)
    fetchData()
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    if (filterTool) params.set('tool_type', filterTool)
    if (filterGrade) params.set('grade', filterGrade)
    if (filterSubject) params.set('subject', filterSubject)
    if (filterQuality) params.set('quality', filterQuality)
    if (search) params.set('search', search)

    const res = await fetch(`/api/admin/university?${params}`)
    if (res.ok) {
      const data = await res.json()
      setItems(data.items)
      setTotal(data.total)
      setStats(data.stats)
    }
    setLoading(false)
  }, [page, filterTool, filterGrade, filterSubject, filterQuality, search])

  useEffect(() => { fetchData() }, [fetchData])

  function openEdit(item: ContentItem) {
    setEditItem(item)
    setEditTitle(item.title)
    setEditQuality(item.quality)
    setEditGrade(item.grade ?? '')
    setEditSubject(item.subject ?? '')
  }

  async function handleSave() {
    if (!editItem) return
    setSaving(true)
    const res = await fetch('/api/admin/university', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editItem.id,
        title: editTitle,
        quality: editQuality,
        grade: editGrade || null,
        subject: editSubject || null,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setItems(prev => prev.map(i => i.id === editItem.id ? data.item : i))
      setEditItem(null)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const res = await fetch('/api/admin/university', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setItems(prev => prev.filter(i => i.id !== id))
      setTotal(prev => prev - 1)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Bright Tale University</h1>
        <p className="text-sm text-adm-muted mt-1">
          Content library, curriculum, and learning analytics
        </p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total Content', value: stats.totalContent, color: 'text-white' },
            { label: 'Quizzes', value: stats.quizzes, color: 'text-indigo-400' },
            { label: 'Flashcards', value: stats.flashcards, color: 'text-violet-400' },
            { label: 'Study Guides', value: stats.studyGuides, color: 'text-emerald-400' },
            { label: 'Courses', value: stats.courses, color: 'text-amber-400' },
            { label: 'Units', value: stats.units, color: 'text-blue-400' },
            { label: 'Lessons', value: stats.lessons, color: 'text-pink-400' },
          ].map(s => (
            <div key={s.label} className="bg-adm-card border border-adm-border rounded-xl px-4 py-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-adm-muted uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Batch generation controls */}
      <div className="bg-adm-card border border-adm-border rounded-xl px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-white font-medium">Generate Content:</p>
          <button onClick={() => handleBatchGenerate('quiz')} disabled={generating}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg border border-adm-border hover:bg-white/5 transition-colors disabled:opacity-50">
            {generating ? 'Generating...' : 'Quizzes (10)'}
          </button>
          <button onClick={() => handleBatchGenerate('flashcards')} disabled={generating}
            className="text-xs font-semibold text-violet-400 hover:text-violet-300 px-3 py-1.5 rounded-lg border border-adm-border hover:bg-white/5 transition-colors disabled:opacity-50">
            Flashcards (10)
          </button>
          <button onClick={() => handleBatchGenerate('study-guide')} disabled={generating}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg border border-adm-border hover:bg-white/5 transition-colors disabled:opacity-50">
            Study Guides (10)
          </button>
          <button onClick={() => handleBatchGenerate()} disabled={generating}
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 px-3 py-1.5 rounded-lg border border-brand-400/30 bg-brand-500/10 hover:bg-brand-500/20 transition-colors disabled:opacity-50">
            All Types (10)
          </button>
          {generating && (
            <div className="w-4 h-4 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
          )}
        </div>
        {genResult && (
          <div className="mt-3 text-xs">
            <p className={genResult.generated > 0 ? 'text-green-400' : 'text-adm-muted'}>
              Generated {genResult.generated} of {genResult.total} items
            </p>
            {genResult.errors?.map((e, i) => (
              <p key={i} className="text-red-400 mt-1">{e}</p>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-adm-card border border-adm-border rounded-xl px-4 py-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <select value={filterTool} onChange={e => { setFilterTool(e.target.value); setPage(1) }}
            className="bg-adm-bg border border-adm-border text-white text-sm rounded-lg px-3 py-2">
            <option value="">All tools</option>
            {TOOL_TYPES.map(t => <option key={t} value={t}>{TOOL_LABELS[t]}</option>)}
          </select>

          <select value={filterGrade} onChange={e => { setFilterGrade(e.target.value); setPage(1) }}
            className="bg-adm-bg border border-adm-border text-white text-sm rounded-lg px-3 py-2">
            <option value="">All grades</option>
            {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
          </select>

          <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setPage(1) }}
            className="bg-adm-bg border border-adm-border text-white text-sm rounded-lg px-3 py-2">
            <option value="">All subjects</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={filterQuality} onChange={e => { setFilterQuality(e.target.value); setPage(1) }}
            className="bg-adm-bg border border-adm-border text-white text-sm rounded-lg px-3 py-2">
            <option value="">All quality</option>
            {QUALITY_LEVELS.map(q => <option key={q} value={q}>{q.charAt(0).toUpperCase() + q.slice(1)}</option>)}
          </select>

          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search topics..."
              className="bg-adm-bg border border-adm-border text-white text-sm rounded-lg px-3 py-2 flex-1 placeholder:text-adm-muted"
            />
            <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Content table */}
      <div className="bg-adm-card border border-adm-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-adm-muted">No content found</p>
            <p className="text-sm text-adm-muted">
              Content is automatically added when students use learning tools.
              Run the migration to create the content_library table first.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-adm-border text-adm-muted text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">Title / Topic</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Quality</th>
                    <th className="px-4 py-3 text-right">Uses</th>
                    <th className="px-4 py-3 text-right">Avg Score</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-adm-border/50 hover:bg-adm-bg/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium text-sm truncate max-w-[200px]">{item.title}</p>
                        <p className="text-adm-muted text-xs truncate max-w-[200px]">{item.topic}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-white/70">{TOOL_LABELS[item.tool_type] ?? item.tool_type}</span>
                      </td>
                      <td className="px-4 py-3 text-white/70">{item.grade ?? '—'}</td>
                      <td className="px-4 py-3 text-white/70 text-xs">{item.subject ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${QUALITY_COLORS[item.quality] ?? 'bg-gray-100 text-gray-600'}`}>
                          {item.quality}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-white/70">{item.use_count}</td>
                      <td className="px-4 py-3 text-right">
                        {item.avg_score != null ? (
                          <span className={`font-semibold ${item.avg_score >= 80 ? 'text-green-400' : item.avg_score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                            {Math.round(item.avg_score)}%
                          </span>
                        ) : (
                          <span className="text-adm-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-adm-muted capitalize">{item.source}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {JSON.stringify(item.content) === '{}' ? (
                            <button onClick={() => handleGenerateOne(item.id)} disabled={generating}
                              className="text-xs text-amber-400 hover:text-amber-300 font-medium px-2 py-1 rounded transition-colors disabled:opacity-50">
                              {generating ? '...' : 'Generate'}
                            </button>
                          ) : (
                            <button onClick={() => setViewItem(item)}
                              className="text-xs text-brand-400 hover:text-brand-300 font-medium px-2 py-1 rounded transition-colors">
                              View
                            </button>
                          )}
                          <button onClick={() => openEdit(item)}
                            className="text-xs text-white/50 hover:text-white font-medium px-2 py-1 rounded transition-colors">
                            Edit
                          </button>
                          <button onClick={() => { if (confirm('Remove this content?')) handleDelete(item.id) }}
                            className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded transition-colors">
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-adm-border">
                <p className="text-xs text-adm-muted">
                  {total} items · Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                    className="text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-lg border border-adm-border disabled:opacity-30 transition-colors">
                    ← Prev
                  </button>
                  <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                    className="text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-lg border border-adm-border disabled:opacity-30 transition-colors">
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* View modal */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-adm-card border border-adm-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{viewItem.title}</p>
                <p className="text-xs text-adm-muted mt-0.5">
                  {TOOL_LABELS[viewItem.tool_type]} · Grade {viewItem.grade ?? 'Any'} · {viewItem.subject ?? 'General'}
                  · {viewItem.use_count} uses · Source: {viewItem.source}
                </p>
              </div>
              <button onClick={() => setViewItem(null)} className="text-adm-muted hover:text-white text-lg">✕</button>
            </div>

            {viewItem.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {viewItem.tags.map(t => (
                  <span key={t} className="text-[10px] bg-adm-bg border border-adm-border text-adm-muted px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            )}

            <pre className="text-xs text-white/70 bg-adm-bg rounded-xl p-4 overflow-x-auto border border-adm-border max-h-[400px] overflow-y-auto">
              {JSON.stringify(viewItem.content, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-adm-card border border-adm-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-white">Edit Content</p>
              <button onClick={() => setEditItem(null)} className="text-adm-muted hover:text-white text-lg">✕</button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-adm-muted">Title</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full bg-adm-bg border border-adm-border text-white text-sm rounded-lg px-3 py-2" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-adm-muted">Grade</label>
                  <select value={editGrade} onChange={e => setEditGrade(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-adm-bg border border-adm-border text-white text-sm rounded-lg px-3 py-2">
                    <option value="">Any</option>
                    {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-adm-muted">Subject</label>
                  <select value={editSubject} onChange={e => setEditSubject(e.target.value)}
                    className="w-full bg-adm-bg border border-adm-border text-white text-sm rounded-lg px-3 py-2">
                    <option value="">General</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-adm-muted">Quality</label>
                <div className="flex gap-2">
                  {QUALITY_LEVELS.map(q => (
                    <button key={q} onClick={() => setEditQuality(q)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        editQuality === q
                          ? 'border-brand-400 bg-brand-500/20 text-brand-400'
                          : 'border-adm-border text-adm-muted hover:text-white'
                      }`}>
                      {q.charAt(0).toUpperCase() + q.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditItem(null)}
                className="text-sm text-adm-muted hover:text-white px-4 py-2.5 rounded-xl border border-adm-border transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
