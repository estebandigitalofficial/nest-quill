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

const BOOK_TYPE_COLORS: Record<string, string> = {
  textbook: 'bg-blue-50 text-blue-700 border-blue-200',
  workbook: 'bg-green-50 text-green-700 border-green-200',
  teacher_guide: 'bg-purple-50 text-purple-700 border-purple-200',
  supplemental: 'bg-gray-50 text-gray-600 border-gray-200',
  read_aloud: 'bg-pink-50 text-pink-700 border-pink-200',
  reference: 'bg-amber-50 text-amber-700 border-amber-200',
}

const BOOK_TYPE_LABELS: Record<string, string> = {
  textbook: 'Textbook',
  workbook: 'Workbook',
  teacher_guide: 'Teacher Guide',
  supplemental: 'Supplemental',
  read_aloud: 'Read Aloud',
  reference: 'Reference',
}

export default function CurriculumBrowser() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'units' | 'books'>('units')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const params = new URLSearchParams({ units: 'true', books: 'true' })
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
            {g <= 8 ? `Grade ${g}` : g === 9 ? 'Freshman' : g === 10 ? 'Sophomore' : g === 11 ? 'Junior' : 'Senior'}
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
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-2xl text-oxford">
                  {Number(grade) <= 8 ? `Grade ${grade}` : Number(grade) === 9 ? 'Freshman (Grade 9)' : Number(grade) === 10 ? 'Sophomore (Grade 10)' : Number(grade) === 11 ? 'Junior (Grade 11)' : 'Senior (Grade 12)'}
                </h2>
                <Link
                  href={`/homeschool/grade/${grade}`}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full transition-colors"
                >
                  Full Dashboard →
                </Link>
              </div>

              <div className="space-y-3">
                {gradeCourses.map(course => {
                  const isExpanded = expandedCourse === course.id
                  const subjectColor = SUBJECT_COLORS[course.subject] ?? 'bg-gray-50 border-gray-200 text-gray-700'
                  const accent = SUBJECT_ACCENT[course.subject] ?? 'border-gray-300'
                  const units = course.curriculum_units ?? []
                  const books = course.curriculum_books ?? []

                  return (
                    <div key={course.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <button
                        onClick={() => {
                          setExpandedCourse(isExpanded ? null : course.id)
                          setActiveTab('units')
                        }}
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
                          {books.length > 0 && (
                            <span className="text-xs text-charcoal-light">{books.length} books</span>
                          )}
                          <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                            </svg>
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className={`border-t-2 ${accent}`}>
                          {/* Tab navigation */}
                          <div className="flex border-b border-gray-100">
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveTab('units') }}
                              className={`px-6 py-3 text-sm font-semibold transition-colors ${
                                activeTab === 'units'
                                  ? 'text-oxford border-b-2 border-oxford -mb-px'
                                  : 'text-charcoal-light hover:text-oxford'
                              }`}
                            >
                              Curriculum ({units.length})
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveTab('books') }}
                              className={`px-6 py-3 text-sm font-semibold transition-colors ${
                                activeTab === 'books'
                                  ? 'text-oxford border-b-2 border-oxford -mb-px'
                                  : 'text-charcoal-light hover:text-oxford'
                              }`}
                            >
                              Books & Resources ({books.length})
                            </button>
                          </div>

                          {/* Units tab */}
                          {activeTab === 'units' && (
                            <div className="px-6 py-4 space-y-2">
                              {units.length > 0 ? units.map((unit, i) => (
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
                              )) : (
                                <p className="text-sm text-charcoal-light py-4 text-center">
                                  Units for this course are being built. Check back soon.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Books tab */}
                          {activeTab === 'books' && (
                            <div className="px-6 py-4 space-y-3">
                              {books.length > 0 ? books.map(book => (
                                <div key={book.id} className="flex items-start gap-4 py-3 border-b border-gray-50 last:border-0">
                                  <div className="w-10 h-12 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-sm font-semibold text-oxford">{book.title}</p>
                                      {book.is_required && (
                                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">Required</span>
                                      )}
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${BOOK_TYPE_COLORS[book.book_type] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                        {BOOK_TYPE_LABELS[book.book_type] ?? book.book_type}
                                      </span>
                                    </div>
                                    <p className="text-xs text-charcoal-light mt-0.5">
                                      by {book.author}
                                      {book.publisher && ` · ${book.publisher}`}
                                      {book.isbn && ` · ISBN: ${book.isbn}`}
                                    </p>
                                    {book.description && (
                                      <p className="text-xs text-gray-500 mt-1">{book.description}</p>
                                    )}
                                    {book.purchase_url && (
                                      <a
                                        href={book.purchase_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 mt-2 transition-colors"
                                      >
                                        View on Amazon
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                        </svg>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )) : (
                                <p className="text-sm text-charcoal-light py-4 text-center">
                                  Book recommendations are being curated. Check back soon.
                                </p>
                              )}
                            </div>
                          )}
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
