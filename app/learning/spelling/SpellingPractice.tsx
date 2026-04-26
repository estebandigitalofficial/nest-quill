'use client'

import { useState, useRef, useEffect } from 'react'
import { submitAssignment } from '@/lib/utils/submitAssignment'

type Stage = 'setup' | 'practice' | 'results'

interface Props {
  assignmentId?: string
}

export default function SpellingPractice({ assignmentId }: Props) {
  const [wordInput, setWordInput] = useState('')
  const [words, setWords] = useState<string[]>([])
  const [stage, setStage] = useState<Stage>('setup')
  const [current, setCurrent] = useState(0)
  const [answer, setAnswer] = useState('')
  const [results, setResults] = useState<{ word: string; typed: string; correct: boolean }[]>([])
  const [revealed, setRevealed] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [xpEarned, setXpEarned] = useState<number | null>(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    if (stage === 'practice') inputRef.current?.focus()
  }, [stage, current])

  // Auto-submit when results appear
  useEffect(() => {
    if (stage === 'results' && assignmentId && !submittedRef.current) {
      submittedRef.current = true
      const correctCount = results.filter(r => r.correct).length
      submitAssignment(assignmentId, { score: correctCount, total: words.length }).then(result => {
        if (result) setXpEarned(result.xpEarned)
      })
    }
  }, [stage, assignmentId, results, words.length])

  function startPractice() {
    const parsed = wordInput
      .split(/[\n,]+/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0)
    if (parsed.length < 2) return
    setWords(parsed)
    setResults([])
    setCurrent(0)
    setAnswer('')
    setRevealed(false)
    submittedRef.current = false; setXpEarned(null)
    setStage('practice')
  }

  function handleCheck() {
    const word = words[current]
    const typed = answer.trim().toLowerCase()
    const correct = typed === word
    if (!correct && !revealed) { setShake(true); setTimeout(() => setShake(false), 500) }
    const newResults = [...results, { word, typed, correct }]
    setResults(newResults)
    setRevealed(true)
  }

  function handleNext() {
    if (current < words.length - 1) {
      setCurrent(c => c + 1)
      setAnswer('')
      setRevealed(false)
    } else {
      setStage('results')
    }
  }

  function reset() { setStage('setup'); setWordInput(''); setWords([]); setResults([]); setAnswer(''); setRevealed(false); submittedRef.current = false; setXpEarned(null) }
  function retry() { setCurrent(0); setAnswer(''); setRevealed(false); setResults([]); setStage('practice') }

  const word = words[current]
  const score = results.filter(r => r.correct).length
  const maskedWord = word ? word.split('').map((_, i) => i === 0 ? word[i].toUpperCase() : '_').join(' ') : ''

  if (stage === 'setup') {
    const parsed = wordInput.split(/[\n,]+/).map(w => w.trim()).filter(w => w.length > 0)
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Enter your spelling words</label>
          <p className="text-xs text-gray-400">Separate with commas or put each word on a new line</p>
          <textarea rows={5}
            placeholder={"cat\ndog\nbird\n\nor: cat, dog, bird"}
            value={wordInput} onChange={e => setWordInput(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none" />
          {parsed.length > 0 && (
            <p className="text-xs text-indigo-600 font-medium">{parsed.length} word{parsed.length !== 1 ? 's' : ''} entered</p>
          )}
        </div>
        <button onClick={startPractice} disabled={parsed.length < 2}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-base transition-colors">
          Start Practice →
        </button>
      </div>
    )
  }

  if (stage === 'practice') {
    return (
      <div className="space-y-4">
        {/* Progress */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{current + 1} of {words.length}</span>
          <span className="text-green-600 font-medium">{score} correct ✓</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${(current / words.length) * 100}%` }} />
        </div>

        {/* Word hint */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 px-6 py-8 text-center space-y-3">
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Spell this word</p>
          <p className="font-mono text-3xl font-bold text-gray-300 tracking-widest">{revealed ? word.toUpperCase() : maskedWord}</p>
          <p className="text-xs text-gray-300">{word.length} letters</p>
        </div>

        {/* Input */}
        <div className={`transition-transform ${shake ? 'animate-bounce' : ''}`}>
          <input ref={inputRef}
            type="text" value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { revealed ? handleNext() : handleCheck() } }}
            disabled={revealed}
            placeholder="Type the word here…"
            className={`w-full rounded-xl border-2 px-4 py-4 text-center text-lg font-semibold tracking-wider focus:outline-none transition-colors ${
              revealed
                ? results[results.length - 1]?.correct
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : 'border-red-400 bg-red-50 text-red-700'
                : 'border-gray-200 text-gray-900 focus:border-indigo-400'
            }`} />
        </div>

        {revealed && !results[results.length - 1]?.correct && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-red-600">The correct spelling is: <span className="font-bold">{word}</span></p>
          </div>
        )}

        {!revealed ? (
          <button onClick={handleCheck} disabled={!answer.trim()}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-base transition-colors">
            Check →
          </button>
        ) : (
          <button onClick={handleNext}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base transition-colors">
            {current < words.length - 1 ? 'Next Word →' : 'See Results →'}
          </button>
        )}
      </div>
    )
  }

  if (stage === 'results') {
    const pct = score / words.length
    return (
      <div className="space-y-4">
        {assignmentId && (
          <div className="bg-indigo-600 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-semibold text-sm">Quest Complete! ✨</p>
              <p className="text-indigo-200 text-xs">{xpEarned != null ? `+${xpEarned} XP earned` : 'Submitting…'}</p>
            </div>
            <button onClick={() => { window.location.href = '/classroom/student' }}
              className="bg-white text-indigo-600 text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap hover:bg-indigo-50 transition-colors shrink-0">
              Back to Dashboard →
            </button>
          </div>
        )}
        <div className={`rounded-2xl px-6 py-6 text-center space-y-1 ${pct === 1 ? 'bg-yellow-50 border border-yellow-200' : pct >= 0.8 ? 'bg-green-50 border border-green-200' : 'bg-indigo-50 border border-indigo-200'}`}>
          <div className="text-4xl mb-2">{pct === 1 ? '🏆' : pct >= 0.8 ? '⭐' : '📚'}</div>
          <p className="text-2xl font-bold text-gray-900">{score} / {words.length}</p>
          <p className="text-sm text-gray-600">{pct === 1 ? 'All correct! Amazing!' : pct >= 0.8 ? 'Great job!' : 'Keep practicing!'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`flex items-center justify-between py-2 border-b border-gray-50 last:border-0 ${r.correct ? '' : 'opacity-90'}`}>
              <span className={`text-sm font-semibold ${r.correct ? 'text-gray-800' : 'text-red-600'}`}>{r.word}</span>
              {r.correct
                ? <span className="text-xs text-green-600 font-bold">✓ Correct</span>
                : <span className="text-xs text-red-500">✗ You wrote: <span className="font-mono">{r.typed || '(blank)'}</span></span>}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={retry} className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">Practice Again</button>
          <button onClick={reset} className="w-full py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">New Word List</button>
        </div>
      </div>
    )
  }

  return null
}
