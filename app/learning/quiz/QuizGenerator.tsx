'use client'

import { useState } from 'react'
import Link from 'next/link'

const SUBJECTS = [
  { value: 'math', label: '➕ Math' },
  { value: 'science', label: '🔬 Science' },
  { value: 'reading', label: '📖 Reading' },
  { value: 'history', label: '🏛️ History' },
  { value: 'social_studies', label: '🌍 Social Studies' },
  { value: 'spelling', label: '✏️ Spelling' },
]

interface Question {
  question: string
  options: [string, string, string, string]
  correct_index: 0 | 1 | 2 | 3
  explanation: string
}

type Stage = 'form' | 'loading' | 'quiz' | 'results'

export default function QuizGenerator() {
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [stage, setStage] = useState<Stage>('form')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState<(number | null)[]>([])
  const [score, setScore] = useState<number | null>(null)

  async function handleGenerate() {
    if (!topic.trim()) { setError('Enter a topic first.'); return }
    setError(null)
    setStage('loading')

    const res = await fetch('/api/learning/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic.trim(), subject: subject || undefined, grade: grade ?? undefined }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.message ?? 'Failed to generate quiz.')
      setStage('form')
      return
    }

    setQuestions(data.questions)
    setSelected(Array(data.questions.length).fill(null))
    setCurrentQ(0)
    setStage('quiz')
  }

  function handleSubmit() {
    const correct = selected.filter((s, i) => s === questions[i].correct_index).length
    setScore(correct)
    setStage('results')
  }

  function handleReset() {
    setTopic('')
    setSubject('')
    setGrade(null)
    setError(null)
    setStage('form')
    setQuestions([])
    setSelected([])
    setScore(null)
    setCurrentQ(0)
  }

  const q = questions[currentQ]
  const allAnswered = selected.length > 0 && selected.every(s => s !== null)

  // ── Form ──────────────────────────────────────────────────────────────────────
  if (stage === 'form') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-6">

        {/* Topic */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Topic or homework content</label>
          <textarea
            rows={3}
            placeholder="e.g. &quot;Fractions — adding with unlike denominators&quot; or paste notes from class..."
            value={topic}
            onChange={e => setTopic(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none transition-colors"
          />
        </div>

        {/* Subject (optional) */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Subject <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SUBJECTS.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSubject(subject === s.value ? '' : s.value)}
                className={`text-left px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                  subject === s.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grade (optional) */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Grade level <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {[1,2,3,4,5,6,7,8].map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGrade(grade === g ? null : g)}
                className={`w-10 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${
                  grade === g
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          onClick={handleGenerate}
          disabled={!topic.trim()}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-base transition-colors"
        >
          Generate Quiz →
        </button>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-gray-600">Writing your quiz…</p>
        <p className="text-xs text-gray-400">Usually takes about 5 seconds</p>
      </div>
    )
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────────
  if (stage === 'quiz') {
    return (
      <div className="space-y-4">
        {/* Progress dots */}
        <div className="flex gap-2 justify-center">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentQ ? 'bg-indigo-600 scale-125' : selected[i] !== null ? 'bg-indigo-300' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Question card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">
              Question {currentQ + 1} of {questions.length}
            </span>
            {subject && grade && (
              <span className="text-xs text-gray-400">{subject} · Grade {grade}</span>
            )}
          </div>
          <p className="text-base font-semibold text-gray-900 leading-snug">{q.question}</p>
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {q.options.map((opt, i) => {
            const isSelected = selected[currentQ] === i
            return (
              <button
                key={i}
                onClick={() => {
                  const next = [...selected]
                  next[currentQ] = i
                  setSelected(next)
                }}
                className={`w-full text-left px-5 py-3.5 rounded-2xl border-2 text-sm transition-all font-medium ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="inline-flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
                    isSelected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 text-gray-400'
                  }`}>
                    {['A','B','C','D'][i]}
                  </span>
                  {opt}
                </span>
              </button>
            )
          })}
        </div>

        {/* Nav */}
        <div className="flex gap-3">
          {currentQ > 0 && (
            <button
              onClick={() => setCurrentQ(q => q - 1)}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
          )}
          {currentQ < questions.length - 1 ? (
            <button
              onClick={() => setCurrentQ(q => q + 1)}
              disabled={selected[currentQ] === null}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm transition-colors"
            >
              {allAnswered ? 'Submit Quiz →' : `${selected.filter(s => s !== null).length}/${questions.length} answered`}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────────
  if (stage === 'results' && score !== null) {
    const pct = score / questions.length
    return (
      <div className="space-y-4">

        {/* Score banner */}
        <div className={`rounded-2xl px-6 py-6 text-center space-y-1 ${
          pct === 1 ? 'bg-yellow-50 border border-yellow-200' :
          pct >= 0.8 ? 'bg-green-50 border border-green-200' :
          pct >= 0.6 ? 'bg-blue-50 border border-blue-200' :
          'bg-gray-50 border border-gray-200'
        }`}>
          <div className="text-4xl mb-2">
            {pct === 1 ? '🏆' : pct >= 0.8 ? '⭐' : pct >= 0.6 ? '👏' : '📚'}
          </div>
          <p className="text-2xl font-bold text-gray-900">{score} / {questions.length}</p>
          <p className="text-sm font-medium text-gray-600">
            {pct === 1 ? 'Perfect score! Outstanding!' :
             pct >= 0.8 ? 'Great work!' :
             pct >= 0.6 ? 'Good effort — keep going!' :
             'Keep studying and try again!'}
          </p>
          {topic && <p className="text-xs text-gray-400 mt-1">Topic: {topic}</p>}
        </div>

        {/* Answer review */}
        <div className="space-y-3">
          {questions.map((q, i) => {
            const isCorrect = selected[i] === q.correct_index
            return (
              <div
                key={i}
                className={`bg-white rounded-2xl border-2 px-5 py-4 space-y-2 ${
                  isCorrect ? 'border-green-200' : 'border-red-200'
                }`}
              >
                <p className="text-sm font-semibold text-gray-800">{i + 1}. {q.question}</p>
                <div className="flex gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {isCorrect ? '✓ Correct' : `✗ You chose: ${q.options[selected[i] ?? 0]}`}
                  </span>
                  {!isCorrect && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                      ✓ {q.options[q.correct_index]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 italic">{q.explanation}</p>
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={() => { setStage('quiz'); setSelected(Array(questions.length).fill(null)); setCurrentQ(0) }}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
          >
            Retake Quiz
          </button>
          <button
            onClick={handleReset}
            className="w-full py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Try a New Topic
          </button>
          <Link
            href="/create?mode=learning"
            className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm text-center transition-colors"
          >
            Turn this into a Learning Story →
          </Link>
        </div>
      </div>
    )
  }

  return null
}
