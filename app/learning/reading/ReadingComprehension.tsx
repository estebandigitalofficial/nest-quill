'use client'

import { useState } from 'react'

interface Question {
  question: string
  options: [string, string, string, string]
  correct_index: 0 | 1 | 2 | 3
  explanation: string
}

type Stage = 'form' | 'loading' | 'quiz' | 'results'

export default function ReadingComprehension() {
  const [text, setText] = useState('')
  const [grade, setGrade] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('form')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState<(number | null)[]>([])
  const [score, setScore] = useState<number | null>(null)

  async function handleGenerate() {
    if (!text.trim() || text.trim().length < 50) { setError('Please paste at least a paragraph of text.'); return }
    setError(null); setStage('loading')

    const res = await fetch('/api/learning/reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), grade: grade ?? undefined }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.message); setStage('form'); return }

    setQuestions(data.questions)
    setSelected(Array(data.questions.length).fill(null))
    setCurrentQ(0); setStage('quiz')
  }

  function handleSubmit() {
    setScore(questions.filter((q, i) => selected[i] === q.correct_index).length)
    setStage('results')
  }

  function reset() { setStage('form'); setText(''); setGrade(null); setError(null); setQuestions([]); setSelected([]); setScore(null) }

  const q = questions[currentQ]
  const allAnswered = selected.every(s => s !== null)

  if (stage === 'form') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Paste your reading passage</label>
          <p className="text-xs text-gray-400">From a textbook, worksheet, article, or any text your child needs to read</p>
          <textarea rows={7} placeholder="Paste the text here…"
            value={text} onChange={e => setText(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none leading-relaxed" />
          {text.length > 0 && <p className="text-xs text-gray-400">{text.split(/\s+/).filter(Boolean).length} words</p>}
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Grade <span className="text-gray-400 font-normal">(optional)</span></label>
          <div className="flex flex-wrap gap-2">
            {[1,2,3,4,5,6,7,8].map(g => (
              <button key={g} type="button" onClick={() => setGrade(grade === g ? null : g)}
                className={`w-10 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${grade === g ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>{g}</button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
        <button onClick={handleGenerate} disabled={text.trim().length < 50}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-base transition-colors">
          Generate Questions →
        </button>
      </div>
    )
  }

  if (stage === 'loading') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-gray-600">Reading your passage and writing questions…</p>
      </div>
    )
  }

  if (stage === 'quiz') {
    return (
      <div className="space-y-4">
        {/* Passage (collapsed) */}
        <details className="bg-gray-50 border border-gray-200 rounded-xl">
          <summary className="px-4 py-3 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700">
            View reading passage ↓
          </summary>
          <div className="px-4 pb-4 text-sm text-gray-700 leading-relaxed border-t border-gray-200 pt-3">
            {text}
          </div>
        </details>

        {/* Progress */}
        <div className="flex gap-2 justify-center">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrentQ(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentQ ? 'bg-indigo-600 scale-125' : selected[i] !== null ? 'bg-indigo-300' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-3">
          <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Question {currentQ + 1} of {questions.length}</span>
          <p className="text-base font-semibold text-gray-900 leading-snug">{q.question}</p>
        </div>

        <div className="space-y-2.5">
          {q.options.map((opt, i) => {
            const isSel = selected[currentQ] === i
            return (
              <button key={i} onClick={() => { const n = [...selected]; n[currentQ] = i; setSelected(n) }}
                className={`w-full text-left px-5 py-3.5 rounded-2xl border-2 text-sm transition-all font-medium ${isSel ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}>
                <span className="inline-flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${isSel ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 text-gray-400'}`}>{['A','B','C','D'][i]}</span>
                  {opt}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex gap-3">
          {currentQ > 0 && (
            <button onClick={() => setCurrentQ(q => q - 1)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">← Back</button>
          )}
          {currentQ < questions.length - 1 ? (
            <button onClick={() => setCurrentQ(q => q + 1)} disabled={selected[currentQ] === null}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm transition-colors">Next →</button>
          ) : (
            <button onClick={handleSubmit} disabled={!allAnswered}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm transition-colors">
              {allAnswered ? 'Submit →' : `${selected.filter(Boolean).length}/${questions.length} answered`}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (stage === 'results' && score !== null) {
    const pct = score / questions.length
    return (
      <div className="space-y-4">
        <div className={`rounded-2xl px-6 py-6 text-center space-y-1 ${pct === 1 ? 'bg-yellow-50 border border-yellow-200' : pct >= 0.8 ? 'bg-green-50 border border-green-200' : 'bg-indigo-50 border border-indigo-200'}`}>
          <div className="text-4xl mb-2">{pct === 1 ? '🏆' : pct >= 0.8 ? '⭐' : '📖'}</div>
          <p className="text-2xl font-bold text-gray-900">{score} / {questions.length}</p>
          <p className="text-sm text-gray-600">{pct === 1 ? 'Perfect comprehension!' : pct >= 0.8 ? 'Great reading!' : 'Try rereading the passage!'}</p>
        </div>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const isCorrect = selected[i] === q.correct_index
            return (
              <div key={i} className={`bg-white rounded-2xl border-2 px-5 py-4 space-y-2 ${isCorrect ? 'border-green-200' : 'border-red-200'}`}>
                <p className="text-sm font-semibold text-gray-800">{i + 1}. {q.question}</p>
                <div className="flex gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{isCorrect ? '✓ Correct' : `✗ ${q.options[selected[i] ?? 0]}`}</span>
                  {!isCorrect && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">✓ {q.options[q.correct_index]}</span>}
                </div>
                <p className="text-xs text-gray-500 italic">{q.explanation}</p>
              </div>
            )
          })}
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={() => { setStage('quiz'); setSelected(Array(questions.length).fill(null)); setCurrentQ(0) }}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">Retake</button>
          <button onClick={reset} className="w-full py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">New Passage</button>
        </div>
      </div>
    )
  }

  return null
}
