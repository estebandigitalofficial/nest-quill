'use client'

import { useState, useEffect, useCallback } from 'react'

interface TriviaQuestion {
  question: string
  options: string[]
  correct_index: number
  fact: string
}

interface InitialImage { base64: string; mimeType: string; preview: string }

interface Props {
  grade?: number | null
  initialImage?: InitialImage
  onReset: () => void
}

const TIMER_SECONDS = 15

export default function TriviaMode({ grade, initialImage, onReset }: Props) {
  const [questions, setQuestions] = useState<TriviaQuestion[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS)
  const [reasoning, setReasoning] = useState('')

  const generate = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const payload = initialImage
        ? { imageBase64: initialImage.base64, mimeType: initialImage.mimeType, grade: grade ?? undefined }
        : null

      if (!payload) { setError('No content to generate trivia from.'); setLoading(false); return }

      const res = await fetch('/api/learning/trivia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      setLoading(false)
      if (!res.ok) { setError(data.message); return }
      setQuestions(data.questions)
    } catch {
      setLoading(false)
      setError('Something went wrong.')
    }
  }, [initialImage, grade])

  useEffect(() => {
    generate()
  }, [generate])

  // Visual-only timer — resets per question, does not auto-reveal
  useEffect(() => {
    if (!questions || revealed || done) return
    setTimeLeft(TIMER_SECONDS)

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [current, questions, revealed, done])

  function handleSelect(i: number) {
    if (revealed) return
    setSelected(i)
    setRevealed(true)
    if (i === questions![current].correct_index) setScore(s => s + 1)
  }

  function handleNext() {
    if (!questions) return
    if (current < questions.length - 1) {
      setCurrent(c => c + 1)
      setSelected(null)
      setRevealed(false)
      setReasoning('')
    } else {
      setDone(true)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-gray-600">Generating trivia questions…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
        <button onClick={generate} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-500 transition-colors">Try Again</button>
        <button onClick={onReset} className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">← Back</button>
      </div>
    )
  }

  if (!questions) return null

  if (done) {
    const pct = score / questions.length
    return (
      <div className="space-y-4">
        <div className={`rounded-2xl px-6 py-8 text-center space-y-2 ${pct === 1 ? 'bg-yellow-50 border border-yellow-200' : pct >= 0.7 ? 'bg-green-50 border border-green-200' : 'bg-indigo-50 border border-indigo-200'}`}>
          <p className="text-xl font-bold mb-3">{pct === 1 ? 'Perfect!' : pct >= 0.7 ? 'Great job!' : 'Keep going!'}</p>
          <p className="text-3xl font-bold text-gray-900">{score} / {questions.length}</p>
          <p className="font-semibold text-gray-700">{pct === 1 ? 'Perfect! You know it all!' : pct >= 0.7 ? 'Great score!' : 'Good effort — keep studying!'}</p>
        </div>
        <button onClick={() => { setCurrent(0); setSelected(null); setRevealed(false); setScore(0); setDone(false); setReasoning('') }}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">
          Play Again
        </button>
        <button onClick={onReset}
          className="w-full py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
          ← Try a Different Activity
        </button>
      </div>
    )
  }

  const q = questions[current]
  const timerPct = (timeLeft / TIMER_SECONDS) * 100

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">{current + 1} / {questions.length}</span>
        <span className="text-xs font-bold text-indigo-600">{score} pts</span>
      </div>

      {/* Visual-only timer bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-1.5 rounded-full bg-indigo-300 transition-all duration-1000 ease-linear"
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* Question */}
      <div className="bg-oxford rounded-2xl px-6 py-6 text-white">
        <p className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-2">Question {current + 1}</p>
        <p className="text-base font-semibold leading-snug">{q.question}</p>
      </div>

      {/* Options */}
      <div className="space-y-2.5">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correct_index
          const isSelected = selected === i
          let cls = 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
          if (revealed) {
            if (isCorrect) cls = 'border-green-400 bg-green-50 text-green-800'
            else if (isSelected && !isCorrect) cls = 'border-red-400 bg-red-50 text-red-700'
            else cls = 'border-gray-100 bg-gray-50 text-gray-400'
          } else if (isSelected) {
            cls = 'border-indigo-500 bg-indigo-50 text-indigo-800'
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={revealed}
              className={`w-full text-left px-5 py-3.5 rounded-2xl border-2 text-sm font-medium transition-all disabled:cursor-default ${cls}`}
            >
              <span className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${revealed && isCorrect ? 'border-green-500 bg-green-500 text-white' : revealed && isSelected && !isCorrect ? 'border-red-400 bg-red-400 text-white' : 'border-gray-300 text-gray-400'}`}>
                  {['A','B','C','D'][i]}
                </span>
                {opt}
              </span>
            </button>
          )
        })}
      </div>

      {/* Fact reveal */}
      {revealed && (
        <div className={`rounded-xl px-4 py-3 text-sm ${selected === q.correct_index ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {selected === q.correct_index ? '✓ Correct! ' : '✗ Not quite. '}
          <span className="text-gray-700">{q.fact}</span>
        </div>
      )}

      {/* Reasoning prompt */}
      {revealed && selected !== null && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800">Why do you think that's the answer?</p>
          <textarea
            value={reasoning}
            onChange={e => setReasoning(e.target.value)}
            placeholder="Explain your thinking… (optional)"
            rows={2}
            className="w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
          />
        </div>
      )}

      {revealed && (
        <button onClick={handleNext}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">
          {current < questions.length - 1 ? 'Next Question →' : 'See Results →'}
        </button>
      )}
    </div>
  )
}
