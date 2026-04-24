'use client'

import { useState } from 'react'

interface Card { front: string; back: string }
type Stage = 'form' | 'loading' | 'study' | 'done'

export default function FlashcardGenerator() {
  const [topic, setTopic] = useState('')
  const [grade, setGrade] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('form')
  const [cards, setCards] = useState<Card[]>([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<boolean[]>([])

  async function handleGenerate() {
    if (!topic.trim()) { setError('Enter a topic first.'); return }
    setError(null); setStage('loading')

    const res = await fetch('/api/learning/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic.trim(), grade: grade ?? undefined }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.message); setStage('form'); return }

    setCards(data.cards)
    setKnown(Array(data.cards.length).fill(false))
    setCurrent(0); setFlipped(false); setStage('study')
  }

  function handleKnow(didKnow: boolean) {
    const next = [...known]; next[current] = didKnow; setKnown(next)
    if (current < cards.length - 1) { setCurrent(c => c + 1); setFlipped(false) }
    else setStage('done')
  }

  function restart() {
    setCurrent(0); setFlipped(false); setKnown(Array(cards.length).fill(false)); setStage('study')
  }

  function reset() {
    setTopic(''); setGrade(null); setStage('form'); setCards([]); setError(null)
  }

  const card = cards[current]
  const knownCount = known.filter(Boolean).length

  if (stage === 'form') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Topic or subject</label>
          <input type="text" placeholder='e.g. "The American Revolution" or "Multiplication tables"'
            value={topic} onChange={e => setTopic(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
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
        <button onClick={handleGenerate} disabled={!topic.trim()}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-base transition-colors">
          Generate Flashcards →
        </button>
      </div>
    )
  }

  if (stage === 'loading') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-gray-600">Creating your flashcards…</p>
      </div>
    )
  }

  if (stage === 'study' && card) {
    return (
      <div className="space-y-4">
        {/* Progress */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{current + 1} of {cards.length}</span>
          <span className="text-green-600 font-medium">{knownCount} known ✓</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${((current) / cards.length) * 100}%` }} />
        </div>

        {/* Card — flip on click */}
        <button
          onClick={() => setFlipped(f => !f)}
          className="w-full min-h-52 bg-white rounded-2xl border-2 border-gray-100 shadow-sm px-6 py-8 flex flex-col items-center justify-center gap-3 transition-all hover:border-indigo-200 hover:shadow-md"
          style={{ perspective: 600 }}
        >
          {!flipped ? (
            <>
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Term</span>
              <p className="text-xl font-semibold text-gray-900 text-center leading-snug">{card.front}</p>
              <span className="text-xs text-gray-300 mt-2">Tap to reveal →</span>
            </>
          ) : (
            <>
              <span className="text-xs font-bold text-green-500 uppercase tracking-widest">Definition</span>
              <p className="text-base text-gray-700 text-center leading-relaxed">{card.back}</p>
            </>
          )}
        </button>

        {/* Actions — only show after flip */}
        {flipped ? (
          <div className="flex gap-3">
            <button onClick={() => handleKnow(false)}
              className="flex-1 py-3.5 rounded-xl border-2 border-red-200 bg-red-50 text-red-600 font-semibold text-sm hover:bg-red-100 transition-colors">
              Still learning 🔄
            </button>
            <button onClick={() => handleKnow(true)}
              className="flex-1 py-3.5 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 font-semibold text-sm hover:bg-green-100 transition-colors">
              Got it ✓
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            {current > 0 && (
              <button onClick={() => { setCurrent(c => c - 1); setFlipped(false) }}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">← Back</button>
            )}
            <button onClick={() => setFlipped(true)}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">Reveal Answer</button>
          </div>
        )}
      </div>
    )
  }

  if (stage === 'done') {
    return (
      <div className="space-y-4">
        <div className={`rounded-2xl px-6 py-6 text-center space-y-2 ${knownCount === cards.length ? 'bg-yellow-50 border border-yellow-200' : 'bg-indigo-50 border border-indigo-200'}`}>
          <div className="text-4xl mb-1">{knownCount === cards.length ? '🏆' : '📚'}</div>
          <p className="text-2xl font-bold text-gray-900">{knownCount} / {cards.length}</p>
          <p className="text-sm text-gray-600">cards marked as known</p>
          <p className="text-xs text-gray-400 mt-1">{topic}{grade ? ` · Grade ${grade}` : ''}</p>
        </div>

        {knownCount < cards.length && (
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Cards to review ({cards.length - knownCount}):</p>
            {cards.filter((_, i) => !known[i]).map((c, i) => (
              <div key={i} className="py-1.5 border-b border-gray-50 last:border-0">
                <p className="text-xs font-semibold text-gray-700">{c.front}</p>
                <p className="text-xs text-gray-400">{c.back}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button onClick={restart} className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">Study Again</button>
          <button onClick={reset} className="w-full py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">New Topic</button>
        </div>
      </div>
    )
  }

  return null
}
