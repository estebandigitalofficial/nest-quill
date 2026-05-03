'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Unit {
  id: string
  title: string
  description: string | null
  week_start: number | null
  week_end: number | null
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
}

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const SUBJECT_COLORS: Record<string, string> = {
  Math: 'bg-blue-50 border-blue-200 text-blue-700',
  English: 'bg-violet-50 border-violet-200 text-violet-700',
  Science: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  'Social Studies': 'bg-amber-50 border-amber-200 text-amber-700',
  History: 'bg-rose-50 border-rose-200 text-rose-700',
}

const SUBJECT_ACCENT: Record<string, string> = {
  Math: 'border-blue-300',
  English: 'border-violet-300',
  Science: 'border-emerald-300',
  'Social Studies': 'border-amber-300',
  History: 'border-rose-300',
}

export default function CurriculumBrowser() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const params = new URLSearchParams({ units: 'true' })
      if (selectedGrade) params.set('grade', String(selectedGrade))
      const res = await fetch(`/api/curriculum?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCourses(data.courses)
      }
      setLoading(false)
    }
    load()
  }, [selectedGrade])

  // Group courses by grade
  const byGrade: Record<number, Course[]> = {}
  for (const c of courses) {
    if (!byGrade[c.grade]) byGrade[c.grade] = []
    byGrade[c.grade].push(c)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      {/* Grade filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedGrade(null)}
          className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${
            selectedGrade === null
              ? 'border-oxford bg-oxford text-white'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          All Grades
        </button>
        {GRADES.map(g => (
          <button
            key={g}
            onClick={() => setSelectedGrade(selectedGrade === g ? null : g)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${
              selectedGrade === g
                ? 'border-oxford bg-oxford text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            Grade {g}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-16 text-center space-y-3">
          <p className="font-semibold text-oxford">No courses found</p>
          <p className="text-sm text-charcoal-light">
            Run the curriculum seed migration to populate courses.
          </p>
        </div>
      ) : (
        Object.entries(byGrade)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([grade, gradeCourses]) => (
            <div key={grade} className="space-y-4">
              <h2 className="font-serif text-2xl text-oxford">Grade {grade}</h2>

              <div className="space-y-3">
                {gradeCourses.map(course => {
                  const isExpanded = expandedCourse === course.id
                  const subjectColor = SUBJECT_COLORS[course.subject] ?? 'bg-gray-50 border-gray-200 text-gray-700'
                  const accent = SUBJECT_ACCENT[course.subject] ?? 'border-gray-300'
                  const units = course.curriculum_units ?? []

                  return (
                    <div key={course.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <button
                        onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                        className="w-full px-6 py-5 flex items-center gap-4 text-left hover:bg-gray-50/50 transition-colors"
                      >
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${subjectColor}`}>
                          {course.subject}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-oxford text-sm">{course.title}</p>
                          {course.description && (
                            <p className="text-xs text-charcoal-light mt-0.5 truncate">{course.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {units.length > 0 && (
                            <span className="text-xs text-charcoal-light">{units.length} units</span>
                          )}
                          <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                            </svg>
                          </span>
                        </div>
                      </button>

                      {isExpanded && units.length > 0 && (
                        <div className={`border-t-2 ${accent} px-6 py-4 space-y-2`}>
                          {units.map((unit, i) => (
                            <div key={unit.id} className="flex items-start gap-3 py-2">
                              <span className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-oxford">{unit.title}</p>
                                {unit.description && (
                                  <p className="text-xs text-charcoal-light mt-0.5">{unit.description}</p>
                                )}
                              </div>
                              {unit.week_start && unit.week_end && (
                                <span className="text-[10px] text-gray-400 shrink-0 mt-1">
                                  Weeks {unit.week_start}–{unit.week_end}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {isExpanded && units.length === 0 && (
                        <div className="border-t border-gray-100 px-6 py-6 text-center">
                          <p className="text-sm text-charcoal-light">
                            Units for this course are being built. Check back soon.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
      )}

      {/* CTA */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-6 text-center space-y-3">
        <h3 className="font-serif text-xl text-oxford">Ready to start?</h3>
        <p className="text-sm text-charcoal-light max-w-md mx-auto">
          All courses and learning tools are free during beta. Pick any subject and start learning today.
        </p>
        <Link
          href="/learning"
          className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-colors"
        >
          Start learning free →
        </Link>
      </div>
    </div>
  )
}
