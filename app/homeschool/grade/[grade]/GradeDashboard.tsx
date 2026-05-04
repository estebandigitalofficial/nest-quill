'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

interface TeachingGuide {
  id: string
  title: string
  objectives: string[]
  materials: string[]
  instruction_plan: {
    daily_lessons?: { day: number; title: string; duration: number; description: string }[]
    hands_on_activities?: { title: string; type: string; description: string; materials: string[] }[]
    science_experiments?: { title: string; objective?: string; description: string; materials: string[]; steps?: string[]; what_to_observe?: string; discussion_questions?: string[] }[]
    parent_tips?: string[]
  }
  assessment_ideas: string[]
  differentiation: { struggling?: string; advanced?: string; english_learners?: string }
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
  sort_order: number
}

interface Course {
  id: string
  grade: number
  subject: string
  title: string
  description: string | null
  duration_weeks: number | null
  sort_order: number
  curriculum_units?: Unit[]
  curriculum_books?: Book[]
}

interface GradeData {
  grade: number
  courses: Course[]
  materials: string[]
  stats: { quizzes: number; flashcards: number; studyGuides: number; totalCourses: number }
}

// ── Constants ────────────────────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, { bg: string; border: string; text: string; accent: string; light: string }> = {
  Math:             { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: 'bg-blue-500', light: 'bg-blue-100' },
  English:          { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', accent: 'bg-violet-500', light: 'bg-violet-100' },
  Science:          { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'bg-emerald-500', light: 'bg-emerald-100' },
  'Social Studies':  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: 'bg-amber-500', light: 'bg-amber-100' },
  History:          { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', accent: 'bg-rose-500', light: 'bg-rose-100' },
}

const BOOK_TYPE_LABELS: Record<string, string> = {
  textbook: 'Textbook', workbook: 'Workbook', teacher_guide: 'Teacher Guide',
  supplemental: 'Supplemental', read_aloud: 'Read Aloud', reference: 'Reference',
}

const ACTIVITY_TYPE_ICONS: Record<string, string> = {
  game: '🎲', outdoor: '🌳', craft: '✂️', cooking: '🍳', music: '🎵', experiment: '🧪', field_trip: '🚌', story: '📖',
}

// ── Component ────────────────────────────────────────────────────────────────

export default function GradeDashboard({ grade }: { grade: number }) {
  const [data, setData] = useState<GradeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'weekly' | 'materials' | 'books'>('overview')
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null)
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null)
  const [unitTab, setUnitTab] = useState<'lessons' | 'activities' | 'assessment'>('lessons')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await fetch(`/api/homeschool/grade/${grade}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
      setLoading(false)
    }
    load()
  }, [grade])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!data || data.courses.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-4">
        <h2 className="font-serif text-2xl text-oxford">No curriculum found for Grade {grade}</h2>
        <p className="text-sm text-charcoal-light">Content is being built. Check back soon.</p>
        <Link href="/homeschool/courses" className="inline-block text-sm text-brand-600 hover:text-brand-700 font-semibold">
          ← Browse all grades
        </Link>
      </div>
    )
  }

  // Build weekly schedule from all courses
  const weeklySchedule: Record<number, { subject: string; unit: string; unitId: string }[]> = {}
  for (const course of data.courses) {
    for (const unit of (course.curriculum_units ?? [])) {
      if (unit.week_start && unit.week_end) {
        for (let w = unit.week_start; w <= unit.week_end; w++) {
          if (!weeklySchedule[w]) weeklySchedule[w] = []
          weeklySchedule[w].push({ subject: course.subject, unit: unit.title, unitId: unit.id })
        }
      }
    }
  }

  // Count total units and guides
  let totalUnits = 0
  let totalGuides = 0
  let totalActivities = 0
  let totalExperiments = 0
  for (const course of data.courses) {
    for (const unit of (course.curriculum_units ?? [])) {
      totalUnits++
      for (const guide of (unit.curriculum_teaching_guides ?? [])) {
        totalGuides++
        totalActivities += (guide.instruction_plan?.hands_on_activities?.length ?? 0)
        totalExperiments += (guide.instruction_plan?.science_experiments?.length ?? 0)
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Hero header */}
      <div className="bg-oxford rounded-3xl px-6 sm:px-10 py-10 text-center relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-emerald-900/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative space-y-3">
          <p className="text-xs font-bold text-emerald-300 uppercase tracking-widest">Complete Curriculum</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-white">Grade {grade} Homeschool</h1>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Everything you need to teach Grade {grade} — lesson plans, activities, experiments, books, and materials. All in one place.
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Subjects', value: data.courses.length, color: 'text-oxford' },
          { label: 'Units', value: totalUnits, color: 'text-blue-600' },
          { label: 'Lesson Plans', value: totalGuides, color: 'text-violet-600' },
          { label: 'Activities', value: totalActivities, color: 'text-emerald-600' },
          { label: 'Experiments', value: totalExperiments, color: 'text-amber-600' },
          { label: 'Quizzes', value: data.stats.quizzes, color: 'text-indigo-600' },
          { label: 'Flashcards', value: data.stats.flashcards, color: 'text-pink-600' },
          { label: 'Study Guides', value: data.stats.studyGuides, color: 'text-teal-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl px-3 py-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-charcoal-light uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1">
        {([
          { id: 'overview' as const, label: 'Subjects & Lessons' },
          { id: 'weekly' as const, label: 'Weekly Planner' },
          { id: 'materials' as const, label: 'Supply List' },
          { id: 'books' as const, label: 'Books & Resources' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-xs sm:text-sm font-semibold py-2.5 rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-oxford text-white shadow-sm'
                : 'text-charcoal-light hover:text-oxford hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {data.courses.map(course => {
            const colors = SUBJECT_COLORS[course.subject] ?? SUBJECT_COLORS.Math
            const isExpanded = expandedCourse === course.id
            const units = course.curriculum_units ?? []

            return (
              <div key={course.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Course header */}
                <button
                  onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                  className="w-full px-6 py-5 flex items-center gap-4 text-left hover:bg-gray-50/50 transition-colors"
                >
                  <div className={`w-10 h-10 ${colors.accent} rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                    {course.subject.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-oxford">{course.title}</p>
                    {course.description && <p className="text-xs text-charcoal-light mt-0.5 truncate">{course.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-charcoal-light">{units.length} units</span>
                    <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                    </span>
                  </div>
                </button>

                {/* Units list */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {units.map((unit, i) => {
                      const isUnitExpanded = expandedUnit === unit.id
                      const guide = unit.curriculum_teaching_guides?.[0]
                      const lessons = guide?.instruction_plan?.daily_lessons ?? []
                      const activities = guide?.instruction_plan?.hands_on_activities ?? []
                      const experiments = guide?.instruction_plan?.science_experiments ?? []
                      const tips = guide?.instruction_plan?.parent_tips ?? []

                      return (
                        <div key={unit.id} className={`${i > 0 ? 'border-t border-gray-50' : ''}`}>
                          {/* Unit header */}
                          <button
                            onClick={() => {
                              setExpandedUnit(isUnitExpanded ? null : unit.id)
                              setUnitTab('lessons')
                            }}
                            className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-gray-50/30 transition-colors"
                          >
                            <span className={`w-7 h-7 ${colors.light} rounded-lg flex items-center justify-center text-xs font-bold ${colors.text} shrink-0`}>
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-oxford">{unit.title}</p>
                              {unit.description && <p className="text-xs text-charcoal-light mt-0.5">{unit.description}</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {unit.week_start && unit.week_end && (
                                <span className="text-[10px] text-gray-400">Wk {unit.week_start}–{unit.week_end}</span>
                              )}
                              {guide && <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">Guide ready</span>}
                              {!guide && <span className="text-[10px] text-gray-400 font-semibold bg-gray-50 px-2 py-0.5 rounded-full">Coming soon</span>}
                            </div>
                          </button>

                          {/* Expanded unit content */}
                          {isUnitExpanded && guide && (
                            <div className={`mx-6 mb-6 rounded-xl border ${colors.border} overflow-hidden`}>
                              {/* Objectives */}
                              <div className={`${colors.bg} px-5 py-4`}>
                                <p className={`text-xs font-bold ${colors.text} uppercase tracking-widest mb-2`}>Learning Objectives</p>
                                <ul className="space-y-1">
                                  {guide.objectives.map((obj, j) => (
                                    <li key={j} className="text-sm text-oxford flex gap-2">
                                      <span className={`${colors.text} shrink-0`}>•</span>
                                      {obj}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Sub-tabs */}
                              <div className="flex border-b border-gray-100 bg-white">
                                {([
                                  { id: 'lessons' as const, label: `Lessons (${lessons.length})` },
                                  { id: 'activities' as const, label: `Activities (${activities.length + experiments.length})` },
                                  { id: 'assessment' as const, label: 'Assessment' },
                                ]).map(tab => (
                                  <button
                                    key={tab.id}
                                    onClick={(e) => { e.stopPropagation(); setUnitTab(tab.id) }}
                                    className={`px-4 py-2.5 text-xs font-semibold transition-colors ${
                                      unitTab === tab.id ? `${colors.text} border-b-2 ${colors.border} -mb-px` : 'text-charcoal-light hover:text-oxford'
                                    }`}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>

                              {/* Lessons tab */}
                              {unitTab === 'lessons' && (
                                <div className="bg-white p-5 space-y-3">
                                  {lessons.length > 0 ? lessons.map((lesson, j) => (
                                    <div key={j} className="flex gap-3">
                                      <div className={`w-8 h-8 ${colors.light} rounded-lg flex items-center justify-center text-xs font-bold ${colors.text} shrink-0 mt-0.5`}>
                                        D{lesson.day}
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-semibold text-oxford">{lesson.title}</p>
                                          <span className="text-[10px] text-gray-400">{lesson.duration} min</span>
                                        </div>
                                        <p className="text-xs text-charcoal-light mt-0.5 leading-relaxed">{lesson.description}</p>
                                      </div>
                                    </div>
                                  )) : (
                                    <p className="text-sm text-charcoal-light text-center py-4">Lesson plans are being developed.</p>
                                  )}

                                  {/* Parent tips */}
                                  {tips.length > 0 && (
                                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                                      <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">Parent Tips</p>
                                      <ul className="space-y-1">
                                        {tips.map((tip, j) => (
                                          <li key={j} className="text-xs text-amber-900 flex gap-2">
                                            <span className="text-amber-500 shrink-0">💡</span>
                                            {tip}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Materials needed */}
                                  <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                                    <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Materials Needed</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {guide.materials.map((mat, j) => (
                                        <span key={j} className="text-[11px] bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{mat}</span>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Standards */}
                                  {guide.standards.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Standards Alignment</p>
                                      <div className="flex flex-wrap gap-1">
                                        {guide.standards.map((std, j) => (
                                          <span key={j} className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{std}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Activities tab */}
                              {unitTab === 'activities' && (
                                <div className="bg-white p-5 space-y-4">
                                  {/* Hands-on activities */}
                                  {activities.length > 0 && (
                                    <div className="space-y-3">
                                      <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Hands-On Activities</p>
                                      {activities.map((act, j) => (
                                        <div key={j} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span>{ACTIVITY_TYPE_ICONS[act.type] ?? '📌'}</span>
                                            <p className="text-sm font-semibold text-oxford">{act.title}</p>
                                            <span className="text-[10px] text-gray-400 capitalize">{act.type}</span>
                                          </div>
                                          <p className="text-xs text-charcoal-light leading-relaxed">{act.description}</p>
                                          {act.materials.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                              {act.materials.map((m, k) => (
                                                <span key={k} className="text-[10px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{m}</span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Science experiments */}
                                  {experiments.length > 0 && (
                                    <div className="space-y-3">
                                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Science Experiments</p>
                                      {experiments.map((exp, j) => (
                                        <div key={j} className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span>🧪</span>
                                            <p className="text-sm font-semibold text-oxford">{exp.title}</p>
                                          </div>
                                          <p className="text-xs text-charcoal-light leading-relaxed mb-2">{exp.description}</p>
                                          {exp.steps && exp.steps.length > 0 && (
                                            <div className="mb-2">
                                              <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Steps</p>
                                              <ol className="list-decimal list-inside space-y-0.5">
                                                {exp.steps.map((step, k) => (
                                                  <li key={k} className="text-xs text-charcoal-light">{step}</li>
                                                ))}
                                              </ol>
                                            </div>
                                          )}
                                          {exp.materials.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                              {exp.materials.map((m, k) => (
                                                <span key={k} className="text-[10px] bg-emerald-100 border border-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded-full">{m}</span>
                                              ))}
                                            </div>
                                          )}
                                          {exp.what_to_observe && (
                                            <p className="text-xs text-emerald-800 mt-2 italic">Observe: {exp.what_to_observe}</p>
                                          )}
                                          {exp.discussion_questions && exp.discussion_questions.length > 0 && (
                                            <div className="mt-2">
                                              <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Discussion</p>
                                              <ul className="space-y-0.5">
                                                {exp.discussion_questions.map((q, k) => (
                                                  <li key={k} className="text-xs text-charcoal-light">• {q}</li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {activities.length === 0 && experiments.length === 0 && (
                                    <p className="text-sm text-charcoal-light text-center py-4">Activities are being developed for this unit.</p>
                                  )}

                                  {/* Quick links to learning tools */}
                                  <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-2">Digital Learning Tools</p>
                                    <p className="text-xs text-indigo-800 mb-3">Use these AI-powered tools for this unit&apos;s topic:</p>
                                    <div className="flex flex-wrap gap-2">
                                      {[
                                        { label: 'Take Quiz', href: `/learning/quiz?topic=${encodeURIComponent(unit.title)}&grade=${grade}&subject=${encodeURIComponent(course.subject)}` },
                                        { label: 'Flashcards', href: `/learning/flashcards?topic=${encodeURIComponent(unit.title)}&grade=${grade}&subject=${encodeURIComponent(course.subject)}` },
                                        { label: 'Study Guide', href: `/learning/study-guide?topic=${encodeURIComponent(unit.title)}&grade=${grade}&subject=${encodeURIComponent(course.subject)}` },
                                      ].map(tool => (
                                        <Link
                                          key={tool.label}
                                          href={tool.href}
                                          className="text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                                        >
                                          {tool.label} →
                                        </Link>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Assessment tab */}
                              {unitTab === 'assessment' && (
                                <div className="bg-white p-5 space-y-4">
                                  {/* Assessment ideas */}
                                  <div>
                                    <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Assessment Ideas</p>
                                    <ul className="space-y-2">
                                      {guide.assessment_ideas.map((idea, j) => (
                                        <li key={j} className="text-sm text-oxford flex gap-2">
                                          <span className="text-gray-400 shrink-0">☐</span>
                                          {idea}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* Differentiation */}
                                  <div className="space-y-2">
                                    <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Differentiation Strategies</p>
                                    {guide.differentiation.struggling && (
                                      <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                                        <p className="text-[10px] font-bold text-orange-600 uppercase mb-0.5">If Struggling</p>
                                        <p className="text-xs text-orange-900">{guide.differentiation.struggling}</p>
                                      </div>
                                    )}
                                    {guide.differentiation.advanced && (
                                      <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                                        <p className="text-[10px] font-bold text-purple-600 uppercase mb-0.5">If Advanced</p>
                                        <p className="text-xs text-purple-900">{guide.differentiation.advanced}</p>
                                      </div>
                                    )}
                                    {guide.differentiation.english_learners && (
                                      <div className="bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
                                        <p className="text-[10px] font-bold text-sky-600 uppercase mb-0.5">English Learners</p>
                                        <p className="text-xs text-sky-900">{guide.differentiation.english_learners}</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Auto-graded tools link */}
                                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                                    <p className="text-xs font-bold text-emerald-700 mb-1">Auto-Graded Assessment</p>
                                    <p className="text-xs text-emerald-800 mb-2">Generate an auto-graded quiz for this unit:</p>
                                    <Link
                                      href={`/learning/quiz?topic=${encodeURIComponent(unit.title)}&grade=${grade}&subject=${encodeURIComponent(course.subject)}`}
                                      className="inline-block text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg transition-colors"
                                    >
                                      Generate Quiz →
                                    </Link>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Expanded but no guide */}
                          {isUnitExpanded && !guide && (
                            <div className="mx-6 mb-6 bg-gray-50 border border-gray-200 rounded-xl px-5 py-6 text-center space-y-2">
                              <p className="text-sm text-charcoal-light">Teaching guide is being developed for this unit.</p>
                              <p className="text-xs text-gray-400">You can still use the learning tools:</p>
                              <div className="flex flex-wrap gap-2 justify-center mt-2">
                                <Link href={`/learning/quiz?topic=${encodeURIComponent(unit.title)}&grade=${grade}`} className="text-xs font-semibold text-brand-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Quiz →</Link>
                                <Link href={`/learning/flashcards?topic=${encodeURIComponent(unit.title)}&grade=${grade}`} className="text-xs font-semibold text-brand-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Flashcards →</Link>
                                <Link href={`/learning/study-guide?topic=${encodeURIComponent(unit.title)}&grade=${grade}`} className="text-xs font-semibold text-brand-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Study Guide →</Link>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── WEEKLY PLANNER TAB ── */}
      {activeTab === 'weekly' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-2xl px-6 py-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">36-Week School Year</p>
            <p className="text-sm text-charcoal-light">Each week shows which units are active across all subjects. Follow at your own pace.</p>
          </div>

          <div className="space-y-2">
            {Array.from({ length: 36 }, (_, i) => i + 1).map(week => {
              const subjects = weeklySchedule[week] ?? []
              return (
                <div key={week} className="bg-white border border-gray-100 rounded-xl px-5 py-3 flex items-start gap-4">
                  <div className="w-12 text-center shrink-0">
                    <p className="text-xs text-gray-400 uppercase">Week</p>
                    <p className="text-lg font-bold text-oxford">{week}</p>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {subjects.map((s, j) => {
                      const colors = SUBJECT_COLORS[s.subject] ?? SUBJECT_COLORS.Math
                      return (
                        <span key={j} className={`text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border} px-2.5 py-1 rounded-lg`}>
                          {s.subject}: {s.unit}
                        </span>
                      )
                    })}
                    {subjects.length === 0 && <span className="text-xs text-gray-300 italic">No units scheduled</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MATERIALS TAB ── */}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl px-6 py-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Complete Supply List</p>
            <p className="text-sm text-charcoal-light">Everything you need for Grade {grade} across all subjects. Many items are common household objects.</p>
          </div>

          {/* Master supply list */}
          <div className="bg-white border border-gray-100 rounded-2xl px-6 py-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">All Materials ({data.materials.length} items)</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.materials.map((mat, i) => (
                <label key={i} className="flex items-center gap-2 text-sm text-oxford cursor-pointer hover:bg-gray-50 px-2 py-1 rounded-lg transition-colors">
                  <input type="checkbox" className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                  {mat}
                </label>
              ))}
            </div>
          </div>

          {/* By subject */}
          {data.courses.map(course => {
            const colors = SUBJECT_COLORS[course.subject] ?? SUBJECT_COLORS.Math
            const courseMaterials = new Set<string>()
            for (const unit of (course.curriculum_units ?? [])) {
              for (const guide of (unit.curriculum_teaching_guides ?? [])) {
                for (const mat of guide.materials) courseMaterials.add(mat)
              }
            }
            if (courseMaterials.size === 0) return null

            return (
              <div key={course.id} className={`${colors.bg} border ${colors.border} rounded-2xl px-6 py-5`}>
                <p className={`text-xs font-bold ${colors.text} uppercase tracking-widest mb-3`}>{course.subject} Materials</p>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {[...courseMaterials].sort().map((mat, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm text-oxford cursor-pointer px-2 py-1 rounded-lg transition-colors hover:bg-white/50">
                      <input type="checkbox" className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                      {mat}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── BOOKS TAB ── */}
      {activeTab === 'books' && (
        <div className="space-y-6">
          {data.courses.map(course => {
            const colors = SUBJECT_COLORS[course.subject] ?? SUBJECT_COLORS.Math
            const books = course.curriculum_books ?? []
            if (books.length === 0) return null

            return (
              <div key={course.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className={`${colors.bg} px-6 py-4 border-b ${colors.border}`}>
                  <p className={`font-semibold ${colors.text}`}>{course.subject}</p>
                  <p className="text-xs text-charcoal-light">{course.title}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {books.map(book => (
                    <div key={book.id} className="px-6 py-4 flex items-start gap-4">
                      <div className={`w-10 h-12 ${colors.light} rounded-lg flex items-center justify-center shrink-0`}>
                        <svg className={`w-5 h-5 ${colors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-oxford">{book.title}</p>
                          {book.is_required && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">Required</span>}
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
                            {BOOK_TYPE_LABELS[book.book_type] ?? book.book_type}
                          </span>
                        </div>
                        <p className="text-xs text-charcoal-light mt-0.5">
                          by {book.author}{book.publisher && ` · ${book.publisher}`}
                        </p>
                        {book.description && <p className="text-xs text-gray-500 mt-1">{book.description}</p>}
                        {book.purchase_url && (
                          <a href={book.purchase_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 mt-2">
                            View on Amazon
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bottom CTA */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-6 text-center space-y-3">
        <h3 className="font-serif text-xl text-oxford">Ready to start teaching?</h3>
        <p className="text-sm text-charcoal-light max-w-md mx-auto">
          Set up a classroom to track progress, create assignments, and manage your homeschool easily.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/classroom" className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-colors">
            Set up classroom →
          </Link>
          <Link href="/learning" className="inline-block bg-white border border-emerald-300 text-emerald-700 text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-emerald-50 transition-colors">
            Try learning tools
          </Link>
        </div>
      </div>
    </div>
  )
}
