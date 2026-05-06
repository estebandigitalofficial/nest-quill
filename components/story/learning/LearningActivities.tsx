'use client'

// Post-completion activity picker for learning stories. Replaces the
// quiz-only branch on the StoryStatusPage reader with a tabbed view that
// can offer 2-4 activity types based on grade band. The pre-generated
// quiz (story_quizzes table) is wired in as one of the tabs; the other
// activity types are fetched on demand from /api/story/[id]/activities/[type]
// and cached in sessionStorage for the duration of the session so a user
// switching between tabs doesn't trigger a re-fetch.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { StoryQuizResponse } from '@/types/story'
import {
  chooseActivities,
  ACTIVITY_LABELS,
  type ActivityType,
  type ActivityPayload,
  type TriviaPayload,
  type MatchingPayload,
  type FillInBlankPayload,
  type PuzzlePayload,
  type FlashcardsPayload,
} from '@/lib/services/postStoryActivities'

interface Props {
  requestId: string
  grade?: number | null
  subject?: string | null
  storyText: string
  quiz: StoryQuizResponse | null
  /** Renders the existing QuizPage for the 'quiz' tab. */
  renderQuiz: () => React.ReactNode
}

const NON_QUIZ_FETCHABLE: ActivityType[] = ['trivia', 'matching', 'fill_in_the_blank', 'puzzle', 'flashcards']

export default function LearningActivities({ requestId, grade, subject, storyText, quiz, renderQuiz }: Props) {
  // Decide which activity tabs to offer based on grade band + content length.
  // If a pre-generated quiz exists, ensure it's always available even when the
  // band wouldn't have picked it (quiz is the canonical, server-graded option).
  const tabs = useMemo<ActivityType[]>(() => {
    const picked = chooseActivities({ grade, subject, content: storyText })
    if (quiz && !picked.includes('quiz')) picked.unshift('quiz')
    return picked
  }, [quiz, grade, subject, storyText])

  const [active, setActive] = useState<ActivityType>(tabs[0] ?? 'quiz')

  return (
    <div style={{ width: '100%' }}>
      <p style={{ fontSize: 10, color: '#a8a29e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
        After-reading activities
      </p>

      {/* Tab strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
        {tabs.map(t => {
          const isActive = active === t
          return (
            <button
              key={t}
              onClick={() => setActive(t)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 999,
                border: `1.5px solid ${isActive ? '#4f46e5' : '#e7e5e4'}`,
                background: isActive ? '#4f46e5' : 'white',
                color: isActive ? 'white' : '#78716c',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {ACTIVITY_LABELS[t]}
            </button>
          )
        })}
      </div>

      {/* Body */}
      <div style={{ width: '100%' }}>
        {active === 'quiz' && (quiz ? renderQuiz() : <FallbackPanel label="Quiz" />)}
        {active !== 'quiz' && (
          <ActivityFetcher
            requestId={requestId}
            type={active}
          />
        )}
      </div>
    </div>
  )
}

// ── Fetcher + dispatcher ─────────────────────────────────────────────────────

function ActivityFetcher({ requestId, type }: { requestId: string; type: ActivityType }) {
  const [payload, setPayload] = useState<ActivityPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!NON_QUIZ_FETCHABLE.includes(type)) return
    const cacheKey = `activity-${requestId}-${type}`
    const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null
    if (cached) {
      try {
        setPayload(JSON.parse(cached) as ActivityPayload)
        setError(null)
        return
      } catch {
        // fall through to fetch
      }
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setPayload(null)
    fetch(`/api/story/${requestId}/activities/${type}`)
      .then(async res => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(body.message ?? 'This activity is not available right now.')
          return
        }
        setPayload(body as ActivityPayload)
        try { sessionStorage.setItem(cacheKey, JSON.stringify(body)) } catch { /* quota — ignore */ }
      })
      .catch(() => { if (!cancelled) setError('This activity is not available right now.') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [requestId, type])

  if (loading) return <LoadingPanel label={ACTIVITY_LABELS[type]} />
  if (error) return <FallbackPanel label={ACTIVITY_LABELS[type]} message={error} />
  if (!payload) return null

  if (payload.type === 'trivia') return <TriviaRunner payload={payload} />
  if (payload.type === 'matching') return <MatchingRunner payload={payload} />
  if (payload.type === 'fill_in_the_blank') return <FillInBlankRunner payload={payload} />
  if (payload.type === 'puzzle') return <PuzzleRunner payload={payload} />
  if (payload.type === 'flashcards') return <FlashcardsRunner payload={payload} />
  return null
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: '#78716c' }}>
      <div style={{ width: 28, height: 28, margin: '0 auto 12px', border: '2px solid #ede8e1', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ fontSize: 12 }}>Building your {label.toLowerCase()}…</p>
      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function FallbackPanel({ label, message }: { label: string; message?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: '#78716c' }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label} couldn&apos;t be created this time</p>
      <p style={{ fontSize: 11, color: '#a8a29e' }}>{message ?? 'Try another activity from the tabs above.'}</p>
    </div>
  )
}

// ── Trivia ────────────────────────────────────────────────────────────────────

function TriviaRunner({ payload }: { payload: TriviaPayload }) {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [revealed, setRevealed] = useState(false)

  const total = payload.questions.length
  const correctCount = payload.questions.filter((q, i) => answers[i] === q.answer).length

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
        {payload.questions.map((q, i) => {
          const chosen = answers[i]
          const isCorrect = chosen === q.answer
          return (
            <div key={i} style={{ background: 'white', border: '1.5px solid #ede8e1', borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>{i + 1}. {q.question}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {q.choices.map(c => {
                  const selected = chosen === c
                  const showCorrect = revealed && c === q.answer
                  const showWrong = revealed && selected && !isCorrect
                  return (
                    <button
                      key={c}
                      disabled={revealed}
                      onClick={() => setAnswers(a => ({ ...a, [i]: c }))}
                      style={{
                        textAlign: 'left',
                        fontSize: 12,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: `1.5px solid ${showCorrect ? '#86efac' : showWrong ? '#fca5a5' : selected ? '#4f46e5' : '#e7e5e4'}`,
                        background: showCorrect ? '#f0fdf4' : showWrong ? '#fff7f7' : selected ? '#eef2ff' : 'white',
                        color: '#374151',
                        cursor: revealed ? 'default' : 'pointer',
                      }}>
                      {c}
                    </button>
                  )
                })}
              </div>
              {revealed && q.explanation && (
                <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6, fontStyle: 'italic' }}>{q.explanation}</p>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            disabled={Object.keys(answers).length < total}
            style={primaryBtn(Object.keys(answers).length < total)}>
            Reveal answers
          </button>
        ) : (
          <p style={{ fontSize: 13, fontWeight: 600, color: '#0C2340' }}>{correctCount} / {total} correct</p>
        )}
      </div>
    </div>
  )
}

// ── Matching ─────────────────────────────────────────────────────────────────

function MatchingRunner({ payload }: { payload: MatchingPayload }) {
  // Two columns. User clicks a left then a right to bind. Wrong pairs surface
  // a brief shake. Right-side order is shuffled once on mount for replayability.
  const rights = useMemo(() => {
    const arr = payload.pairs.map((p, i) => ({ key: i, text: p.right }))
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [payload])

  const [activeLeft, setActiveLeft] = useState<number | null>(null)
  const [matched, setMatched] = useState<Record<number, number>>({}) // leftIndex -> rightIndex

  function handleRight(rightIdx: number) {
    if (activeLeft === null) return
    if (rightIdx === activeLeft) {
      setMatched(m => ({ ...m, [activeLeft]: rightIdx }))
    }
    setActiveLeft(null)
  }

  const allMatched = Object.keys(matched).length === payload.pairs.length

  return (
    <div style={{ width: '100%' }}>
      <p style={{ fontSize: 11, color: '#78716c', textAlign: 'center', marginBottom: 10 }}>
        Tap a term, then tap its match.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {payload.pairs.map((p, i) => {
            const isMatched = matched[i] !== undefined
            const isActive = activeLeft === i
            return (
              <button
                key={i}
                disabled={isMatched}
                onClick={() => setActiveLeft(i)}
                style={{
                  textAlign: 'left',
                  fontSize: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1.5px solid ${isMatched ? '#86efac' : isActive ? '#4f46e5' : '#e7e5e4'}`,
                  background: isMatched ? '#f0fdf4' : isActive ? '#eef2ff' : 'white',
                  color: isMatched ? '#15803d' : '#374151',
                  fontWeight: 600,
                  cursor: isMatched ? 'default' : 'pointer',
                }}>
                {p.left}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rights.map(r => {
            const isUsed = Object.values(matched).includes(r.key)
            return (
              <button
                key={r.key}
                disabled={isUsed || activeLeft === null}
                onClick={() => handleRight(r.key)}
                style={{
                  textAlign: 'left',
                  fontSize: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1.5px solid ${isUsed ? '#86efac' : '#e7e5e4'}`,
                  background: isUsed ? '#f0fdf4' : 'white',
                  color: '#374151',
                  cursor: isUsed || activeLeft === null ? 'default' : 'pointer',
                  opacity: activeLeft === null && !isUsed ? 0.6 : 1,
                }}>
                {r.text}
              </button>
            )
          })}
        </div>
      </div>
      {allMatched && (
        <p style={{ fontSize: 13, fontWeight: 600, color: '#15803d', textAlign: 'center', marginTop: 12 }}>
          All matched!
        </p>
      )}
    </div>
  )
}

// ── Fill in the Blank ─────────────────────────────────────────────────────────

function FillInBlankRunner({ payload }: { payload: FillInBlankPayload }) {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [revealed, setRevealed] = useState(false)
  const total = payload.items.length
  const correctCount = payload.items.filter((it, i) =>
    (answers[i] ?? '').trim().toLowerCase() === it.answer.trim().toLowerCase()
  ).length

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
        {payload.items.map((it, i) => {
          const userAns = answers[i] ?? ''
          const isCorrect = userAns.trim().toLowerCase() === it.answer.trim().toLowerCase()
          const [before, after] = it.sentence.split('___')
          return (
            <div key={i} style={{ background: 'white', border: '1.5px solid #ede8e1', borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                <span>{before}</span>
                <span
                  style={{
                    display: 'inline-block',
                    minWidth: 70,
                    margin: '0 4px',
                    borderBottom: `2px solid ${revealed ? (isCorrect ? '#86efac' : '#fca5a5') : '#e7e5e4'}`,
                    fontWeight: 600,
                    color: revealed ? (isCorrect ? '#15803d' : '#dc2626') : '#4f46e5',
                  }}>
                  {userAns || ' '}
                </span>
                <span>{after}</span>
              </p>
              {it.choices && it.choices.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {it.choices.map(c => {
                    const selected = userAns === c
                    return (
                      <button
                        key={c}
                        disabled={revealed}
                        onClick={() => setAnswers(a => ({ ...a, [i]: c }))}
                        style={{
                          fontSize: 11,
                          padding: '5px 10px',
                          borderRadius: 999,
                          border: `1.5px solid ${selected ? '#4f46e5' : '#e7e5e4'}`,
                          background: selected ? '#eef2ff' : 'white',
                          color: '#374151',
                          cursor: revealed ? 'default' : 'pointer',
                        }}>
                        {c}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <input
                  disabled={revealed}
                  value={userAns}
                  onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))}
                  placeholder="Type your answer"
                  style={{ marginTop: 8, fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e7e5e4', width: '100%' }}
                />
              )}
              {revealed && !isCorrect && (
                <p style={{ fontSize: 11, color: '#15803d', marginTop: 6 }}>Correct: {it.answer}</p>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        {!revealed ? (
          <button onClick={() => setRevealed(true)} style={primaryBtn(false)}>
            Check answers
          </button>
        ) : (
          <p style={{ fontSize: 13, fontWeight: 600, color: '#0C2340' }}>{correctCount} / {total} correct</p>
        )}
      </div>
    </div>
  )
}

// ── Puzzle ────────────────────────────────────────────────────────────────────

function PuzzleRunner({ payload }: { payload: PuzzlePayload }) {
  const [revealed, setRevealed] = useState(0) // how many clues shown
  const [guess, setGuess] = useState('')
  const [solved, setSolved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit() {
    if (guess.trim().toLowerCase() === payload.answer.trim().toLowerCase()) {
      setSolved(true)
    } else if (revealed < payload.clues.length) {
      setRevealed(r => Math.min(r + 1, payload.clues.length))
      setGuess('')
      inputRef.current?.focus()
    }
  }

  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <p style={{ fontFamily: 'Georgia,"Times New Roman",serif', fontSize: '1.2rem', color: '#0C2340', marginBottom: 12 }}>
        {payload.prompt}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {payload.clues.slice(0, Math.max(1, revealed || 1)).map((c, i) => (
          <div key={i} style={{ background: '#fff8f0', border: '1.5px solid #f5d9b0', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#78716c', textAlign: 'left' }}>
            <span style={{ fontWeight: 700, color: '#C99700', marginRight: 6 }}>Clue {i + 1}:</span>{c}
          </div>
        ))}
      </div>
      {!solved ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={guess}
            onChange={e => setGuess(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
            placeholder="Your guess"
            style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e7e5e4', width: '100%', maxWidth: 280 }}
          />
          <button onClick={handleSubmit} disabled={!guess.trim()} style={primaryBtn(!guess.trim())}>
            {revealed < payload.clues.length ? 'Guess (or reveal next clue)' : 'Final guess'}
          </button>
          <p style={{ fontSize: 10, color: '#a8a29e' }}>
            {revealed} of {payload.clues.length} clues revealed
          </p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#15803d', marginBottom: 4 }}>You got it!</p>
          <p style={{ fontSize: 13, color: '#0C2340' }}>The answer was <strong>{payload.answer}</strong>.</p>
        </div>
      )}
    </div>
  )
}

// ── Flashcards ───────────────────────────────────────────────────────────────

function FlashcardsRunner({ payload }: { payload: FlashcardsPayload }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<boolean[]>(() => Array(payload.cards.length).fill(false))
  const [done, setDone] = useState(false)

  const total = payload.cards.length
  const card = payload.cards[index]

  function mark(didKnow: boolean) {
    const next = known.slice()
    next[index] = didKnow
    setKnown(next)
    if (index < total - 1) {
      setIndex(index + 1)
      setFlipped(false)
    } else {
      setDone(true)
    }
  }

  function reset() {
    setIndex(0)
    setFlipped(false)
    setKnown(Array(total).fill(false))
    setDone(false)
  }

  if (done) {
    const knownCount = known.filter(Boolean).length
    return (
      <div style={{ textAlign: 'center', padding: '20px 8px' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#0C2340', marginBottom: 4 }}>
          {knownCount === total ? 'Perfect!' : 'Nice job!'}
        </p>
        <p style={{ fontSize: 13, color: '#78716c', marginBottom: 14 }}>
          {knownCount} / {total} cards marked as known
        </p>
        <button onClick={reset} style={primaryBtn(false)}>Study again</button>
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      <p style={{ fontSize: 11, color: '#78716c', textAlign: 'center', marginBottom: 8 }}>
        Card {index + 1} of {total} · Tap to flip
      </p>
      <button
        onClick={() => setFlipped(f => !f)}
        style={{
          width: '100%',
          minHeight: 160,
          background: flipped ? '#f0fdf4' : 'white',
          border: `1.5px solid ${flipped ? '#86efac' : '#ede8e1'}`,
          borderRadius: 14,
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          cursor: 'pointer',
          transition: 'background 0.2s, border-color 0.2s',
        }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: flipped ? '#15803d' : '#4f46e5', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          {flipped ? 'Answer' : 'Term'}
        </span>
        <p style={{ fontFamily: flipped ? 'inherit' : 'Georgia,"Times New Roman",serif', fontSize: flipped ? 13 : 18, color: '#0C2340', textAlign: 'center', lineHeight: 1.4, margin: 0 }}>
          {flipped ? card.back : card.front}
        </p>
        {!flipped && (
          <span style={{ fontSize: 10, color: '#a8a29e', marginTop: 6 }}>Tap to reveal →</span>
        )}
      </button>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={() => mark(false)}
          disabled={!flipped}
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1.5px solid #fca5a5',
            background: flipped ? '#fff7f7' : '#fafafa',
            color: flipped ? '#dc2626' : '#d6d3d1',
            cursor: flipped ? 'pointer' : 'not-allowed',
          }}>
          Still learning
        </button>
        <button
          onClick={() => mark(true)}
          disabled={!flipped}
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1.5px solid #86efac',
            background: flipped ? '#f0fdf4' : '#fafafa',
            color: flipped ? '#15803d' : '#d6d3d1',
            cursor: flipped ? 'pointer' : 'not-allowed',
          }}>
          Got it ✓
        </button>
      </div>
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 600,
    color: 'white',
    background: disabled ? '#c7d2fe' : '#4f46e5',
    padding: '8px 18px',
    borderRadius: 10,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
