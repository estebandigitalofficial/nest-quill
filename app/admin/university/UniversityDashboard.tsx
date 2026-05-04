'use client'

import { useEffect, useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface GradeSummary {
  grade: number
  subjects: string[]
  courseCount: number
  unitCount: number
  guideCount: number
  bookCount: number
  contentTotal: number
  contentFilled: number
  contentEmpty: number
}

interface TeachingGuide {
  id: string
  title: string
  objectives: string[]
  materials: string[]
  instruction_plan: Record<string, unknown>
  assessment_ideas: string[]
  standards: string[]
  duration_minutes: number
}

interface Unit {
  id: string
  title: string
  description: string | null
  week_start: number | null
  week_end: number | null
  sort_order: number
  curriculum_teaching_guides?: TeachingGuide[]
}

interface Book {
  id: string
  title: string
  author: string
  isbn: string | null
  publisher: string | null
  purchase_url: string | null
  book_type: string
  is_required: boolean
  description: string | null
}

interface Course {
  id: string
  grade: number
  subject: string
  title: string
  description: string | null
  curriculum_units?: Unit[]
  curriculum_books?: Book[]
}

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
  use_count: number
  avg_score: number | null
  is_active: boolean
}

// ── Constants ────────────────────────────────────────────────────────────────

const GRADE_LABELS: Record<number, string> = {
  1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th',
  7: '7th', 8: '8th', 9: '9th', 10: '10th', 11: '11th', 12: '12th',
}

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  Math:              { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', accent: 'bg-blue-500' },
  English:           { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', accent: 'bg-violet-500' },
  Science:           { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', accent: 'bg-emerald-500' },
  'Social Studies':  { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', accent: 'bg-amber-500' },
  History:           { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', accent: 'bg-rose-500' },
}

const TOOL_LABELS: Record<string, string> = {
  quiz: 'Quiz', flashcards: 'Flashcards', 'study-guide': 'Study Guide',
  explain: 'Explainer', reading: 'Reading', spelling: 'Spelling', math: 'Math',
}

const BOOK_TYPE_LABELS: Record<string, string> = {
  textbook: 'Textbook', workbook: 'Workbook', teacher_guide: 'Teacher Guide',
  supplemental: 'Supplemental', read_aloud: 'Read Aloud', reference: 'Reference',
}

type View = 'grades' | 'grade-detail' | 'library'

// ── Component ────────────────────────────────────────────────────────────────

export default function UniversityDashboard() {
  // Navigation
  const [view, setView] = useState<View>('grades')
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [gradeTab, setGradeTab] = useState<'educator' | 'student' | 'materials'>('educator')
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null)

  // Data
  const [grades, setGrades] = useState<GradeSummary[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  // Generation
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState<{ filled: number; empty: number; total: number } | null>(null)
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoTotal, setAutoTotal] = useState(0)

  // Content library (for the library tab)
  const [libItems, setLibItems] = useState<ContentItem[]>([])
  const [libTotal, setLibTotal] = useState(0)
  const [libPage, setLibPage] = useState(1)
  const [libLoading, setLibLoading] = useState(false)
  const [viewItem, setViewItem] = useState<ContentItem | null>(null)

  // ── Data fetching ────────────────────────────────────────────────────────

  async function fetchGrades() {
    setLoading(true)
    const res = await fetch('/api/admin/university/grades')
    if (res.ok) {
      const data = await res.json()
      setGrades(data.grades)
    }
    setLoading(false)
  }

  async function fetchGradeDetail(grade: number) {
    setDetailLoading(true)
    const res = await fetch(`/api/homeschool/grade/${grade}`)
    if (res.ok) {
      const data = await res.json()
      setCourses(data.courses)
    }
    // Also fetch content items for this grade
    const cRes = await fetch(`/api/admin/university?grade=${grade}&limit=500`)
    if (cRes.ok) {
      const cData = await cRes.json()
      setContentItems(cData.items)
    }
    setDetailLoading(false)
  }

  async function fetchGenProgress() {
    const res = await fetch('/api/admin/university/generate')
    if (res.ok) setGenProgress(await res.json())
  }

  async function fetchLibrary() {
    setLibLoading(true)
    const params = new URLSearchParams({ page: String(libPage), limit: '50' })
    if (selectedGrade) params.set('grade', String(selectedGrade))
    const res = await fetch(`/api/admin/university?${params}`)
    if (res.ok) {
      const data = await res.json()
      setLibItems(data.items)
      setLibTotal(data.total)
    }
    setLibLoading(false)
  }

  useEffect(() => { fetchGrades(); fetchGenProgress() }, [])

  useEffect(() => {
    if (selectedGrade) fetchGradeDetail(selectedGrade)
  }, [selectedGrade])

  useEffect(() => {
    if (view === 'library') fetchLibrary()
  }, [view, libPage, selectedGrade]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generation handlers ──────────────────────────────────────────────────

  const [genCount, setGenCount] = useState(0)

  async function handleGenerateForGrade(grade: number) {
    setGenerating(true)
    setGenCount(0)
    let total = 0
    for (let i = 0; i < 50; i++) {
      const res = await fetch('/api/admin/university/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, limit: 5 }),
      })
      const data = await res.json()
      total += data.generated ?? 0
      setGenCount(total)
      if (!data.generated || data.generated === 0) break
      await new Promise(r => setTimeout(r, 200))
    }
    setGenerating(false)
    setGenCount(0)
    fetchGrades()
    fetchGenProgress()
    if (selectedGrade === grade) fetchGradeDetail(grade)
  }

  async function handleGenerateForSubject(grade: number, subject: string) {
    setGenerating(true)
    setGenCount(0)
    let total = 0
    // Get items for this specific subject
    const res0 = await fetch(`/api/admin/university?grade=${grade}&subject=${encodeURIComponent(subject)}&limit=100`)
    if (!res0.ok) { setGenerating(false); return }
    const { items: subjectItems } = await res0.json()
    const emptyIds = (subjectItems as ContentItem[])
      .filter(i => JSON.stringify(i.content) === '{}')
      .map(i => i.id)

    for (const id of emptyIds) {
      const res = await fetch('/api/admin/university/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      total += data.generated ?? 0
      setGenCount(total)
      await new Promise(r => setTimeout(r, 100))
    }
    setGenerating(false)
    setGenCount(0)
    fetchGenProgress()
    if (selectedGrade === grade) fetchGradeDetail(grade)
  }

  async function handleGenerateAll() {
    setAutoRunning(true)
    setAutoTotal(0)
    let totalGenerated = 0
    for (let i = 0; i < 200; i++) {
      const res = await fetch('/api/admin/university/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 10 }),
      })
      const data = await res.json()
      totalGenerated += data.generated ?? 0
      setAutoTotal(totalGenerated)
      if (!data.generated || data.generated === 0) break
      await new Promise(r => setTimeout(r, 300))
      if (totalGenerated % 50 === 0) fetchGenProgress()
    }
    setAutoRunning(false)
    fetchGrades()
    fetchGenProgress()
  }

  // ── Navigation helpers ───────────────────────────────────────────────────

  function openGrade(grade: number) {
    setSelectedGrade(grade)
    setSelectedSubject(null)
    setGradeTab('educator')
    setExpandedUnit(null)
    setView('grade-detail')
  }

  function goBack() {
    if (selectedSubject) {
      setSelectedSubject(null)
    } else {
      setView('grades')
      setSelectedGrade(null)
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const filteredCourses = selectedSubject
    ? courses.filter(c => c.subject === selectedSubject)
    : courses

  // Aggregate materials for this grade
  const allMaterials = new Set<string>()
  const allBooks: Book[] = []
  for (const course of courses) {
    for (const unit of (course.curriculum_units ?? [])) {
      for (const guide of (unit.curriculum_teaching_guides ?? [])) {
        for (const mat of guide.materials) allMaterials.add(mat)
      }
    }
    for (const book of (course.curriculum_books ?? [])) {
      allBooks.push(book)
    }
  }

  // Split content by type: educator (teaching guides) vs student (quizzes, flashcards, etc.)
  const educatorContent = contentItems.filter(i => ['study-guide', 'explain'].includes(i.tool_type))
  const studentContent = contentItems.filter(i => ['quiz', 'flashcards', 'reading', 'spelling', 'math'].includes(i.tool_type))

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Bright Tale University</h1>
          <p className="text-sm text-adm-muted mt-1">
            {view === 'grades' ? 'Curriculum, content library, and educator materials for all grades' :
             view === 'grade-detail' ? `Grade ${selectedGrade} — ${selectedSubject ?? 'All Subjects'}` :
             'Content Library'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view !== 'grades' && (
            <button onClick={goBack}
              className="text-xs font-semibold text-adm-muted hover:text-white px-3 py-1.5 rounded-lg border border-adm-border transition-colors">
              ← Back
            </button>
          )}
          <button
            onClick={() => { setView(view === 'library' ? 'grades' : 'library'); setLibPage(1) }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              view === 'library' ? 'border-brand-500 bg-brand-500/20 text-brand-400' : 'border-adm-border text-adm-muted hover:text-white'
            }`}
          >
            {view === 'library' ? 'Grade View' : 'Content Library'}
          </button>
        </div>
      </div>

      {/* Global generation progress */}
      {genProgress && genProgress.total > 0 && (
        <div className="bg-adm-card border border-adm-border rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-adm-muted">
              Content Library: {genProgress.filled} filled / {genProgress.empty} empty / {genProgress.total} total
            </p>
            <div className="flex items-center gap-3">
              <p className="text-xs font-bold text-white">
                {Math.round((genProgress.filled / genProgress.total) * 100)}%
              </p>
              <button onClick={handleGenerateAll} disabled={generating || autoRunning}
                className="text-xs font-bold text-white px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50">
                {autoRunning ? `Generating... (${autoTotal})` : 'Generate All'}
              </button>
            </div>
          </div>
          <div className="h-1.5 bg-adm-bg rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-500"
              style={{ width: `${(genProgress.filled / genProgress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          GRADES VIEW — Grade cards grid
          ═══════════════════════════════════════════════════════════════════════ */}
      {view === 'grades' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Elementary */}
              <div>
                <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Elementary (K-5)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {grades.filter(g => g.grade <= 5).map(g => (
                    <GradeCard key={g.grade} grade={g} onClick={() => openGrade(g.grade)} />
                  ))}
                </div>
              </div>

              {/* Middle School */}
              <div>
                <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Middle School (6-8)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
                  {grades.filter(g => g.grade >= 6 && g.grade <= 8).map(g => (
                    <GradeCard key={g.grade} grade={g} onClick={() => openGrade(g.grade)} />
                  ))}
                </div>
              </div>

              {/* High School */}
              <div>
                <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">High School (9-12)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {grades.filter(g => g.grade >= 9).map(g => (
                    <GradeCard key={g.grade} grade={g} onClick={() => openGrade(g.grade)} />
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          GRADE DETAIL VIEW
          ═══════════════════════════════════════════════════════════════════════ */}
      {view === 'grade-detail' && selectedGrade && (
        <>
          {detailLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Subject cards (if no subject selected) */}
              {!selectedSubject && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {courses.map(course => {
                    const colors = SUBJECT_COLORS[course.subject] ?? SUBJECT_COLORS.Math
                    const units = course.curriculum_units ?? []
                    const guides = units.reduce((n, u) => n + (u.curriculum_teaching_guides?.length ?? 0), 0)
                    const books = course.curriculum_books?.length ?? 0

                    return (
                      <button key={course.id} onClick={() => setSelectedSubject(course.subject)}
                        className={`${colors.bg} border ${colors.border} rounded-xl px-4 py-4 text-left hover:brightness-110 transition-all`}>
                        <div className={`w-8 h-8 ${colors.accent} rounded-lg flex items-center justify-center text-white text-xs font-bold mb-3`}>
                          {course.subject.charAt(0)}
                        </div>
                        <p className={`font-semibold text-sm ${colors.text}`}>{course.subject}</p>
                        <p className="text-[10px] text-adm-muted mt-0.5 truncate">{course.title}</p>
                        <div className="flex gap-3 mt-3 text-[10px] text-adm-muted">
                          <span>{units.length} units</span>
                          <span>{guides} guides</span>
                          <span>{books} books</span>
                        </div>
                      </button>
                    )
                  })}

                  {/* Generate for grade button */}
                  <button onClick={() => handleGenerateForGrade(selectedGrade)} disabled={generating}
                    className="border border-dashed border-adm-border rounded-xl px-4 py-4 text-center hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all disabled:opacity-50 group">
                    <div className="w-8 h-8 bg-adm-card border border-adm-border rounded-lg flex items-center justify-center text-adm-muted text-lg mx-auto mb-3 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors">
                      +
                    </div>
                    {generating && <div className="w-4 h-4 border-2 border-emerald-300/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-1" />}
                    <p className="text-xs font-semibold text-adm-muted group-hover:text-emerald-400 transition-colors">
                      {generating ? `Generating... (${genCount})` : 'Generate Content'}
                    </p>
                    <p className="text-[10px] text-adm-muted mt-0.5">Fill empty quizzes, cards, guides</p>
                  </button>
                </div>
              )}

              {/* Tab navigation (when subject selected) */}
              {selectedSubject && (
                <div className="flex gap-1 bg-adm-card border border-adm-border rounded-xl p-1">
                  {([
                    { id: 'educator' as const, label: 'Educator Materials', icon: '📋' },
                    { id: 'student' as const, label: 'Student Materials', icon: '📝' },
                    { id: 'materials' as const, label: 'Supplies & Books', icon: '📦' },
                  ]).map(tab => (
                    <button key={tab.id} onClick={() => setGradeTab(tab.id)}
                      className={`flex-1 text-xs font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        gradeTab === tab.id ? 'bg-white/10 text-white' : 'text-adm-muted hover:text-white'
                      }`}>
                      <span>{tab.icon}</span> {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* ── EDUCATOR TAB ── */}
              {selectedSubject && gradeTab === 'educator' && (
                <div className="space-y-3">
                  <div className="bg-adm-card border border-adm-border rounded-xl px-4 py-3">
                    <p className="text-xs text-adm-muted">
                      Teaching guides, lesson plans, objectives, assessment ideas, and differentiation strategies for educators.
                    </p>
                  </div>

                  {filteredCourses.map(course => (
                    <div key={course.id} className="space-y-2">
                      {(course.curriculum_units ?? []).map((unit, i) => {
                        const guide = unit.curriculum_teaching_guides?.[0]
                        const isExpanded = expandedUnit === unit.id
                        const plan = guide?.instruction_plan as { daily_lessons?: unknown[]; hands_on_activities?: unknown[]; science_experiments?: unknown[]; parent_tips?: string[] } | undefined

                        return (
                          <div key={unit.id} className="bg-adm-card border border-adm-border rounded-xl overflow-hidden">
                            <button onClick={() => setExpandedUnit(isExpanded ? null : unit.id)}
                              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors">
                              <span className="w-6 h-6 bg-adm-bg rounded-md flex items-center justify-center text-[10px] font-bold text-adm-muted shrink-0">
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{unit.title}</p>
                                {unit.description && <p className="text-[10px] text-adm-muted truncate">{unit.description}</p>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {unit.week_start && unit.week_end && (
                                  <span className="text-[10px] text-adm-muted">Wk {unit.week_start}-{unit.week_end}</span>
                                )}
                                {guide ? (
                                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Ready</span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-adm-muted bg-adm-bg px-2 py-0.5 rounded-full">Pending</span>
                                )}
                              </div>
                            </button>

                            {isExpanded && guide && (
                              <div className="border-t border-adm-border px-4 py-4 space-y-4">
                                {/* Objectives */}
                                <div>
                                  <p className="text-[10px] font-bold text-adm-muted uppercase tracking-widest mb-1.5">Learning Objectives</p>
                                  <ul className="space-y-1">
                                    {guide.objectives.map((obj, j) => (
                                      <li key={j} className="text-xs text-white/80 flex gap-2">
                                        <span className="text-emerald-400 shrink-0">-</span>{obj}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* Daily lessons */}
                                {plan?.daily_lessons && (
                                  <div>
                                    <p className="text-[10px] font-bold text-adm-muted uppercase tracking-widest mb-1.5">
                                      Daily Lesson Plan ({(plan.daily_lessons as { title: string }[]).length} days)
                                    </p>
                                    <div className="space-y-1.5">
                                      {(plan.daily_lessons as { day: number; title: string; duration: number; description: string }[]).map((lesson, j) => (
                                        <div key={j} className="bg-adm-bg rounded-lg px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-brand-400">Day {lesson.day}</span>
                                            <span className="text-xs font-medium text-white">{lesson.title}</span>
                                            <span className="text-[10px] text-adm-muted ml-auto">{lesson.duration}m</span>
                                          </div>
                                          <p className="text-[11px] text-adm-muted mt-0.5 leading-relaxed">{lesson.description}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Assessment */}
                                <div>
                                  <p className="text-[10px] font-bold text-adm-muted uppercase tracking-widest mb-1.5">Assessment Ideas</p>
                                  <ul className="space-y-1">
                                    {guide.assessment_ideas.map((idea, j) => (
                                      <li key={j} className="text-xs text-white/70 flex gap-2">
                                        <span className="text-adm-muted shrink-0">☐</span>{idea}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* Parent tips */}
                                {plan?.parent_tips && (plan.parent_tips as string[]).length > 0 && (
                                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Parent / Educator Tips</p>
                                    <ul className="space-y-0.5">
                                      {(plan.parent_tips as string[]).map((tip, j) => (
                                        <li key={j} className="text-[11px] text-amber-200/80">- {tip}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Standards */}
                                {guide.standards.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {guide.standards.map((s, j) => (
                                      <span key={j} className="text-[9px] font-mono bg-adm-bg text-adm-muted px-1.5 py-0.5 rounded border border-adm-border">{s}</span>
                                    ))}
                                  </div>
                                )}

                                {/* Materials for this unit */}
                                <div>
                                  <p className="text-[10px] font-bold text-adm-muted uppercase tracking-widest mb-1.5">Materials Needed</p>
                                  <div className="flex flex-wrap gap-1">
                                    {guide.materials.map((m, j) => (
                                      <span key={j} className="text-[10px] bg-adm-bg border border-adm-border text-adm-muted px-2 py-0.5 rounded-full">{m}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* ── STUDENT TAB ── */}
              {selectedSubject && gradeTab === 'student' && (
                <div className="space-y-3">
                  <div className="bg-adm-card border border-adm-border rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-adm-muted">
                      Auto-graded quizzes, flashcards, study guides, and practice materials for students.
                    </p>
                    <button
                      onClick={() => handleGenerateForSubject(selectedGrade!, selectedSubject)}
                      disabled={generating}
                      className="text-xs font-bold text-white px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50 shrink-0 flex items-center gap-2"
                    >
                      {generating && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {generating ? `Generating... (${genCount})` : `Generate ${selectedSubject} Content`}
                    </button>
                  </div>

                  {filteredCourses.map(course => (
                    <div key={course.id}>
                      {(course.curriculum_units ?? []).map((unit, i) => {
                        // Find matching content for this unit topic
                        const unitContent = contentItems.filter(item =>
                          item.subject?.toLowerCase() === course.subject.toLowerCase() &&
                          item.topic?.toLowerCase() === unit.title.toLowerCase()
                        )
                        const filled = unitContent.filter(c => JSON.stringify(c.content) !== '{}')
                        const empty = unitContent.filter(c => JSON.stringify(c.content) === '{}')

                        return (
                          <div key={unit.id} className="bg-adm-card border border-adm-border rounded-xl px-4 py-3 mb-2">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-[10px] font-bold text-adm-muted w-5">{i + 1}</span>
                              <p className="text-sm font-medium text-white flex-1">{unit.title}</p>
                              <span className="text-[10px] text-adm-muted">{filled.length} ready / {empty.length} empty</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 ml-8">
                              {unitContent.map(item => {
                                const isFilled = JSON.stringify(item.content) !== '{}'
                                const toolPath = item.tool_type === 'study-guide' ? 'study-guide' : item.tool_type
                                const previewUrl = `/learning/${toolPath}?topic=${encodeURIComponent(unit.title)}&grade=${selectedGrade}&subject=${encodeURIComponent(course.subject)}&auto=1`
                                return (
                                  <span key={item.id} className="inline-flex items-center gap-1">
                                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-l-lg border transition-colors ${
                                      isFilled
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                        : 'border-adm-border bg-adm-bg text-adm-muted'
                                    }`}>
                                      {TOOL_LABELS[item.tool_type] ?? item.tool_type}
                                      {isFilled ? ' ✓' : ' ○'}
                                    </span>
                                    {isFilled && (
                                      <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-[10px] font-semibold px-2 py-1 rounded-r-lg border border-l-0 border-brand-500/30 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-colors">
                                        Preview ↗
                                      </a>
                                    )}
                                  </span>
                                )
                              })}
                              {unitContent.length === 0 && (
                                <span className="text-[10px] text-adm-muted italic">No content entries yet</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* ── MATERIALS & BOOKS TAB ── */}
              {selectedSubject && gradeTab === 'materials' && (
                <div className="space-y-4">
                  {/* Books */}
                  {filteredCourses.map(course => {
                    const books = course.curriculum_books ?? []
                    if (books.length === 0) return null
                    const colors = SUBJECT_COLORS[course.subject] ?? SUBJECT_COLORS.Math

                    return (
                      <div key={course.id} className="bg-adm-card border border-adm-border rounded-xl overflow-hidden">
                        <div className={`${colors.bg} px-4 py-3 border-b ${colors.border}`}>
                          <p className={`text-sm font-semibold ${colors.text}`}>Books & Resources</p>
                        </div>
                        <div className="divide-y divide-adm-border/50">
                          {books.map(book => (
                            <div key={book.id} className="px-4 py-3 flex items-start gap-3">
                              <div className={`w-8 h-10 ${colors.bg} rounded-md flex items-center justify-center shrink-0`}>
                                <span className={`text-sm ${colors.text}`}>📖</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-white">{book.title}</p>
                                  {book.is_required && <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">Required</span>}
                                  <span className="text-[9px] text-adm-muted bg-adm-bg px-1.5 py-0.5 rounded border border-adm-border">
                                    {BOOK_TYPE_LABELS[book.book_type] ?? book.book_type}
                                  </span>
                                </div>
                                <p className="text-[11px] text-adm-muted mt-0.5">
                                  {book.author}{book.publisher ? ` · ${book.publisher}` : ''}{book.isbn ? ` · ISBN: ${book.isbn}` : ''}
                                </p>
                                {book.description && <p className="text-[11px] text-adm-muted/70 mt-0.5">{book.description}</p>}
                                {book.purchase_url && (
                                  <a href={book.purchase_url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300 mt-1">
                                    View on Amazon ↗
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  {/* Materials list for this subject */}
                  <div className="bg-adm-card border border-adm-border rounded-xl px-4 py-4">
                    <p className="text-xs font-bold text-adm-muted uppercase tracking-widest mb-3">
                      Supply List — {selectedSubject} ({[...allMaterials].length} items total for all subjects)
                    </p>
                    {filteredCourses.map(course => {
                      const courseMats = new Set<string>()
                      for (const unit of (course.curriculum_units ?? [])) {
                        for (const guide of (unit.curriculum_teaching_guides ?? [])) {
                          for (const mat of guide.materials) courseMats.add(mat)
                        }
                      }
                      if (courseMats.size === 0) return null
                      return (
                        <div key={course.id} className="mb-3">
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1">
                            {[...courseMats].sort().map((mat, i) => (
                              <label key={i} className="flex items-center gap-2 text-xs text-white/70 cursor-pointer hover:bg-white/5 px-2 py-1 rounded transition-colors">
                                <input type="checkbox" className="rounded border-adm-border bg-adm-bg text-brand-500 focus:ring-brand-500 w-3.5 h-3.5" />
                                {mat}
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Subject not selected — show full supply list for the grade */}
              {!selectedSubject && (
                <div className="bg-adm-card border border-adm-border rounded-xl px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-adm-muted uppercase tracking-widest">
                      Grade {selectedGrade} Master Supply List
                    </p>
                    <span className="text-[10px] text-adm-muted">{allMaterials.size} items · {allBooks.length} books</span>
                  </div>
                  {allMaterials.size > 0 ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1">
                      {[...allMaterials].sort().map((mat, i) => (
                        <label key={i} className="flex items-center gap-2 text-xs text-white/70 cursor-pointer hover:bg-white/5 px-2 py-1 rounded transition-colors">
                          <input type="checkbox" className="rounded border-adm-border bg-adm-bg text-brand-500 focus:ring-brand-500 w-3.5 h-3.5" />
                          {mat}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-adm-muted text-center py-4">No materials data yet. Add teaching guides to populate.</p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CONTENT LIBRARY VIEW (flat table)
          ═══════════════════════════════════════════════════════════════════════ */}
      {view === 'library' && (
        <div className="bg-adm-card border border-adm-border rounded-xl overflow-hidden">
          {libLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : libItems.length === 0 ? (
            <p className="text-sm text-adm-muted text-center py-20">No content found</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-adm-border text-adm-muted text-xs uppercase tracking-wider">
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Grade</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3 text-right">Uses</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {libItems.map(item => (
                      <tr key={item.id} className="border-b border-adm-border/50 hover:bg-adm-bg/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-white font-medium text-sm truncate max-w-[250px]">{item.title}</p>
                          <p className="text-adm-muted text-xs truncate max-w-[250px]">{item.topic}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/70">{TOOL_LABELS[item.tool_type] ?? item.tool_type}</td>
                        <td className="px-4 py-3 text-white/70">{item.grade ?? '—'}</td>
                        <td className="px-4 py-3 text-white/70 text-xs">{item.subject ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-white/70">{item.use_count}</td>
                        <td className="px-4 py-3">
                          {JSON.stringify(item.content) !== '{}' ? (
                            <button onClick={() => setViewItem(item)} className="text-xs text-brand-400 hover:text-brand-300 font-medium">View</button>
                          ) : (
                            <span className="text-xs text-adm-muted">Empty</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {Math.ceil(libTotal / 50) > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-adm-border">
                  <p className="text-xs text-adm-muted">{libTotal} items · Page {libPage}</p>
                  <div className="flex gap-2">
                    <button disabled={libPage <= 1} onClick={() => setLibPage(p => p - 1)}
                      className="text-xs text-white/60 px-3 py-1.5 rounded-lg border border-adm-border disabled:opacity-30">← Prev</button>
                    <button disabled={libPage >= Math.ceil(libTotal / 50)} onClick={() => setLibPage(p => p + 1)}
                      className="text-xs text-white/60 px-3 py-1.5 rounded-lg border border-adm-border disabled:opacity-30">Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── View content modal ── */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setViewItem(null)}>
          <div className="bg-adm-card border border-adm-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{viewItem.title}</p>
                <p className="text-xs text-adm-muted mt-0.5">
                  {TOOL_LABELS[viewItem.tool_type]} · Grade {viewItem.grade ?? 'Any'} · {viewItem.subject ?? 'General'}
                </p>
              </div>
              <button onClick={() => setViewItem(null)} className="text-adm-muted hover:text-white text-lg">✕</button>
            </div>
            <pre className="text-xs text-white/70 bg-adm-bg rounded-xl p-4 overflow-x-auto border border-adm-border max-h-[400px] overflow-y-auto">
              {JSON.stringify(viewItem.content, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Grade Card Component ─────────────────────────────────────────────────────

function GradeCard({ grade, onClick }: { grade: GradeSummary; onClick: () => void }) {
  const completion = grade.contentTotal > 0 ? Math.round((grade.contentFilled / grade.contentTotal) * 100) : 0
  const hasGuides = grade.guideCount > 0

  return (
    <button onClick={onClick}
      className="bg-adm-card border border-adm-border rounded-xl px-4 py-4 text-left hover:border-brand-500/50 hover:bg-brand-500/5 transition-all group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl font-bold text-white group-hover:text-brand-400 transition-colors">
          {GRADE_LABELS[grade.grade]}
        </span>
        {hasGuides && (
          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
            Guides
          </span>
        )}
      </div>

      <p className="text-[10px] text-adm-muted mb-2">
        {grade.subjects.join(' · ')}
      </p>

      <div className="grid grid-cols-3 gap-1 text-center mb-2">
        <div>
          <p className="text-xs font-bold text-white">{grade.unitCount}</p>
          <p className="text-[9px] text-adm-muted">Units</p>
        </div>
        <div>
          <p className="text-xs font-bold text-white">{grade.guideCount}</p>
          <p className="text-[9px] text-adm-muted">Guides</p>
        </div>
        <div>
          <p className="text-xs font-bold text-white">{grade.bookCount}</p>
          <p className="text-[9px] text-adm-muted">Books</p>
        </div>
      </div>

      {/* Content completion bar */}
      <div className="space-y-1">
        <div className="h-1 bg-adm-bg rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${completion === 100 ? 'bg-emerald-400' : completion > 0 ? 'bg-brand-400' : 'bg-adm-border'}`}
            style={{ width: `${Math.max(completion, 2)}%` }} />
        </div>
        <p className="text-[9px] text-adm-muted text-right">{completion}% content</p>
      </div>
    </button>
  )
}
