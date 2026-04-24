'use client'

import { useState, useRef, useEffect } from 'react'

const TOPICS = [
  { value: 'addition', label: '➕ Addition' },
  { value: 'subtraction', label: '➖ Subtraction' },
  { value: 'multiplication', label: '✖️ Multiplication' },
  { value: 'division', label: '➗ Division' },
  { value: 'fractions', label: '½ Fractions' },
  { value: 'geometry', label: '📐 Geometry' },
  { value: 'word problems', label: '📝 Word Problems' },
  { value: 'decimals', label: '0.5 Decimals' },
]

interface Problem { problem: string; answer: string; steps: string[] }
type Stage = 'form' | 'loading' | 'practice' | 'results'

export default function MathPractice() {
  const [topic, setTopic] = useState('')
  const [grade, setGrade] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('form')
  const [problems, setProblems] = useState<Problem[]>([])
  const [current, setCurrent] = useState(0)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState<{ correct: boolean; userAnswer: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (stage === 'practice' && !revealed) inputRef.current?.focus() }, [stage, current, revealed])

  async function handleGenerate() {
    if (!topic) { setError('Select a topic first.'); return }
    setError(null); setStage('loading')

    const res = await fetch('/api/learning/math', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, grade: grade ?? undefined }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.message); setStage('form'); return }

    setProblems(data.problems)
    setResults([])
    setCurrent(0); setAnswer(''); setRevealed(false)
    setStage('practice')
  }

  function handleCheck() {
    setRevealed(true)
    const p = problems[current]
    const correct = answer.trim().toLowerCase() === p.answer.toString().toLowerCase()
    setResults(r => [...r, { correct, userAnswer: answer.trim() }])
  }

  function handleNext() {
    if (current < problems.length - 1) { setCurrent(c => c + 1); setAnswer(''); setRevealed(false) }
    else setStage('results')
  }

  function reset() { setStage('form'); setTopic(''); setGrade(null); setError(null); setProblems([]); setResults([]) }
  function retry() { setCurrent(0); setAnswer(''); setRevealed(false); setResults([]); setStage('practice') }

  const p = problems[current]
  const score = results.filter(r => r.correct).length

  if (stage === 'form') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Topic</label>
          <div className="grid grid-cols-2 gap-2">
            {TOPICS.map(t => (
              <button key={t.value} type="button" onClick={() => setTopic(t.value)}
                className={`text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${topic === t.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                {t.label}
              </button>
            ))}
          </div>
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
        <button onClick={handleGenerate} disabled={!topic}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-base transition-colors">
          Generate Problems →
        </button>
      </div>
    )
  }

  if (stage === 'loading') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-gray-600">Generating problems…</p>
      </div>
    )
  }

  if (stage === 'practice' && p) {
    const lastResult = results[results.length - 1]
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Problem {current + 1} of {problems.length}</span>
          <span className="text-green-600 font-medium">{score} correct ✓</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${(current / problems.length) * 100}%` }} />
        </div>

        <div className="bg-white rounded-2xl border-2 border-gray-100 px-6 py-8 text-center">
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">{topic}{grade ? ` · Grade ${grade}` : ''}</p>
          <p className="text-xl font-semibold text-gray-900 leading-relaxed">{p.problem}</p>
        </div>

        {!revealed ? (
          <>
            <input ref={inputRef} type="text" value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && answer.trim()) handleCheck() }}
              placeholder="Your answer…"
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 text-center text-lg font-semibold focus:outline-none focus:border-indigo-400 transition-colors" />
            <div className="flex gap-3">
              <button onClick={() => { setRevealed(true); setResults(r => [...r, { correct: false, userAnswer: '' }]) }}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                Show Answer
              </button>
              <button onClick={handleCheck} disabled={!answer.trim()}
                className="flex-1 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm transition-colors">
                Check →
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {lastResult && (
              <div className={`rounded-xl border px-4 py-3 text-center text-sm font-semibold ${lastResult.correct ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                {lastResult.correct ? '✓ Correct!' : `✗ Answer: ${p.answer}`}
              </div>
            )}
            {p.steps.length > 0 && (
              <div className="bg-gray-50 rounded-xl px-4 py-4 space-y-1.5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Solution steps</p>
                {p.steps.map((step, i) => (
                  <p key={i} className="text-sm text-gray-600 flex gap-2"><span className="text-indigo-400 font-bold shrink-0">{i + 1}.</span>{step}</p>
                ))}
              </div>
            )}
            <button onClick={handleNext} className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">
              {current < problems.length - 1 ? 'Next Problem →' : 'See Results →'}
            </button>
          </div>
        )}
      </div>
    )
  }

  if (stage === 'results') {
    const pct = score / problems.length
    return (
      <div className="space-y-4">
        <div className={`rounded-2xl px-6 py-6 text-center space-y-1 ${pct === 1 ? 'bg-yellow-50 border border-yellow-200' : pct >= 0.75 ? 'bg-green-50 border border-green-200' : 'bg-indigo-50 border border-indigo-200'}`}>
          <div className="text-4xl mb-2">{pct === 1 ? '🏆' : pct >= 0.75 ? '⭐' : '📚'}</div>
          <p className="text-2xl font-bold text-gray-900">{score} / {problems.length}</p>
          <p className="text-sm text-gray-600">{topic}{grade ? ` · Grade ${grade}` : ''}</p>
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={retry} className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">Try Again</button>
          <button onClick={reset} className="w-full py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">New Topic</button>
        </div>
      </div>
    )
  }

  return null
}
