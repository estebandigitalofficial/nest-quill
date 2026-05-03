'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { submitAssignment } from '@/lib/utils/submitAssignment'

type AssignmentType = 'quiz' | 'flashcards' | 'explain' | 'study-guide' | 'reading'

interface BaseAssignment {
  id: string
  title: string
  type: AssignmentType
  config: { topic?: string; grade?: number; source?: string }
  due_at: string | null
  classroom_id: string
  classroom_name: string | null
}

interface QuizContent {
  kind: 'quiz'
  title: string
  sessionId: string
  questions: { question: string; options: string[] }[]
}
interface FlashcardContent {
  kind: 'flashcards'
  title: string
  cards: { front: string; back: string }[]
}
interface ExplainContent {
  kind: 'explain'
  title: string
  sections: { heading: string; content: string }[]
  summary: string
}
interface StudyGuideContent {
  kind: 'study-guide'
  title: string
  overview: string
  key_terms: { term: string; definition: string }[]
  main_concepts: { heading: string; content: string }[]
  remember: string[]
  practice_questions: { question: string; answer: string }[]
}
interface ReadingContent {
  kind: 'reading'
  title: string
  passage: string
  sessionId: string
  questions: { question: string; options: string[] }[]
}

type Content = QuizContent | FlashcardContent | ExplainContent | StudyGuideContent | ReadingContent

interface Submission {
  id: string
  status: string
  score: number | null
  total: number | null
  completed_at: string | null
}

const TYPE_LABEL: Record<AssignmentType, string> = {
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  explain: 'Explain It',
  'study-guide': 'Study Guide',
  reading: 'Reading',
}

export default function AssignmentRunner({ assignmentId }: { assignmentId: string }) {
  const [assignment, setAssignment] = useState<(BaseAssignment & { content: Content }) | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const res = await fetch(`/api/classroom/assignments/${assignmentId}`)
      const data = await res.json()
      if (cancelled) return
      if (!res.ok) {
        setError(data.message ?? 'Failed to load assignment.')
        setLoading(false)
        return
      }
      setAssignment(data.assignment)
      setSubmission(data.submission)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [assignmentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !assignment) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 px-8 py-12 text-center space-y-3">
        <p className="text-lg font-bold text-red-500">!</p>
        <p className="font-semibold text-oxford">{error ?? 'Assignment not found.'}</p>
        <Link href="/classroom/student" className="inline-block text-sm font-semibold text-indigo-600 hover:underline">← Back to Dashboard</Link>
      </div>
    )
  }

  const c = assignment.content
  const typeLabel = TYPE_LABEL[assignment.type] ?? assignment.type
  const due = assignment.due_at
    ? { text: new Date(assignment.due_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), overdue: new Date(assignment.due_at) < new Date() }
    : null
  const alreadyComplete = submission?.status === 'complete'

  return (
    <div className="space-y-5">
      <Header
        title={assignment.title}
        typeLabel={typeLabel}
        classroomName={assignment.classroom_name}
        due={due}
        alreadyComplete={alreadyComplete}
        priorScore={submission?.score ?? null}
        priorTotal={submission?.total ?? null}
      />

      {c.kind === 'quiz' && <QuizRunner assignmentId={assignment.id} content={c} alreadyComplete={alreadyComplete} />}
      {c.kind === 'reading' && <ReadingRunner assignmentId={assignment.id} content={c} alreadyComplete={alreadyComplete} />}
      {c.kind === 'flashcards' && <FlashcardsRunner assignmentId={assignment.id} content={c} alreadyComplete={alreadyComplete} />}
      {c.kind === 'explain' && <ExplainRunner assignmentId={assignment.id} content={c} alreadyComplete={alreadyComplete} />}
      {c.kind === 'study-guide' && <StudyGuideRunner assignmentId={assignment.id} content={c} alreadyComplete={alreadyComplete} />}
      {!c?.kind && (
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-12 text-center space-y-3">
          <p className="font-semibold text-oxford">This assignment is missing its content.</p>
          <p className="text-sm text-charcoal-light">Ask your teacher to recreate it. New assignments include the work right here on this page.</p>
          <Link href="/classroom/student" className="inline-block text-sm font-semibold text-indigo-600 hover:underline">← Back to Dashboard</Link>
        </div>
      )}
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────
function Header({
  title, typeLabel, classroomName, due, alreadyComplete, priorScore, priorTotal,
}: {
  title: string
  typeLabel: string
  classroomName: string | null
  due: { text: string; overdue: boolean } | null
  alreadyComplete: boolean
  priorScore: number | null
  priorTotal: number | null
}) {
  return (
    <div className="bg-oxford rounded-2xl px-6 py-5 text-white space-y-1">
      <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">{typeLabel}{classroomName ? ` · ${classroomName}` : ''}</p>
      <h1 className="font-serif text-xl text-white leading-tight">{title}</h1>
      <div className="flex items-center gap-3 text-xs">
        {due && (
          <span className={due.overdue ? 'text-red-300 font-semibold' : 'text-indigo-200'}>
            {due.overdue ? 'Overdue · ' : 'Due '}{due.text}
          </span>
        )}
        {alreadyComplete && (
          <span className="text-green-300 font-semibold">
            ✓ Completed{priorScore != null && priorTotal != null ? ` · ${priorScore}/${priorTotal}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}

// ── XP / completion banner ────────────────────────────────────
function CompletionBanner({ xpEarned }: { xpEarned: number | null | 'pending' }) {
  if (xpEarned === 'pending') {
    return (
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 text-center">
        <p className="text-xs text-indigo-400">Saving progress…</p>
      </div>
    )
  }
  return (
    <div className="bg-indigo-600 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-white font-semibold text-sm">Assignment Complete!</p>
        <p className="text-indigo-200 text-xs">{xpEarned ? `+${xpEarned} XP earned` : 'Progress saved'}</p>
      </div>
      <Link href="/classroom/student" className="bg-white text-indigo-600 text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap hover:bg-indigo-50 transition-colors shrink-0">
        Dashboard →
      </Link>
    </div>
  )
}

// ── Quiz ──────────────────────────────────────────────────────
interface QuizFeedback { correct_index: number; explanation: string; your_answer: number }

function QuizRunner({ assignmentId, content, alreadyComplete }: { assignmentId: string; content: QuizContent; alreadyComplete: boolean }) {
  const [stage, setStage] = useState<'quiz' | 'grading' | 'results'>('quiz')
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState<(number | null)[]>(Array(content.questions.length).fill(null))
  const [score, setScore] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<QuizFeedback[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [xpEarned, setXpEarned] = useState<number | null | 'pending'>('pending')
  const submittedRef = useRef(false)

  async function handleSubmit() {
    setStage('grading')
    setError(null)
    const res = await fetch('/api/learning/quiz/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: content.sessionId, answers: selected, elapsedSeconds: 60 }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.message ?? 'Failed to submit quiz.')
      setStage('quiz')
      return
    }
    setScore(data.score); setTotal(data.total); setFeedback(data.feedback); setStage('results')

    if (!alreadyComplete && !submittedRef.current) {
      submittedRef.current = true
      const result = await submitAssignment(assignmentId, { score: data.score, total: data.total, quizSessionId: content.sessionId })
      setXpEarned(result?.xpEarned ?? null)
    }
  }

  if (stage === 'grading') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-gray-600">Grading your quiz…</p>
      </div>
    )
  }

  if (stage === 'results' && score !== null && total !== null && feedback) {
    const pct = total > 0 ? score / total : 0
    return (
      <div className="space-y-4">
        {!alreadyComplete && <CompletionBanner xpEarned={xpEarned} />}
        <div className={`rounded-2xl px-6 py-6 text-center space-y-1 ${pct === 1 ? 'bg-yellow-50 border border-yellow-200' : pct >= 0.8 ? 'bg-green-50 border border-green-200' : pct >= 0.6 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
          <p className="text-xl font-bold mb-2">{pct === 1 ? 'Perfect!' : pct >= 0.8 ? 'Great job!' : pct >= 0.6 ? 'Good effort!' : 'Keep going!'}</p>
          <p className="text-2xl font-bold text-gray-900">{score} / {total}</p>
        </div>
        <div className="space-y-3">
          {content.questions.map((q, i) => {
            const fb = feedback[i]
            const isCorrect = fb.your_answer === fb.correct_index
            return (
              <div key={i} className={`bg-white rounded-2xl border-2 px-5 py-4 space-y-2 ${isCorrect ? 'border-green-200' : 'border-red-200'}`}>
                <p className="text-sm font-semibold text-gray-800">{i + 1}. {q.question}</p>
                <div className="flex gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {isCorrect ? '✓ Correct' : `✗ You chose: ${q.options[fb.your_answer]}`}
                  </span>
                  {!isCorrect && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">✓ {q.options[fb.correct_index]}</span>}
                </div>
                <p className="text-xs text-gray-500 italic">{fb.explanation}</p>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const q = content.questions[currentQ]
  const allAnswered = selected.every(s => s !== null)
  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-center">
        {content.questions.map((_, i) => (
          <button key={i} onClick={() => setCurrentQ(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentQ ? 'bg-indigo-600 scale-125' : selected[i] !== null ? 'bg-indigo-300' : 'bg-gray-200'}`} />
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-2">
        <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Question {currentQ + 1} of {content.questions.length}</span>
        <p className="text-base font-semibold text-gray-900 leading-snug">{q.question}</p>
      </div>
      <div className="space-y-2.5">
        {q.options.map((opt, i) => {
          const isSel = selected[currentQ] === i
          return (
            <button key={i} onClick={() => { const n = [...selected]; n[currentQ] = i; setSelected(n) }}
              className={`w-full text-left px-5 py-3.5 rounded-2xl border-2 text-sm transition-all font-medium ${isSel ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}>
              <span className="inline-flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${isSel ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 text-gray-400'}`}>{['A','B','C','D'][i]}</span>
                {opt}
              </span>
            </button>
          )
        })}
      </div>
      {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      <div className="flex gap-3">
        {currentQ > 0 && (
          <button onClick={() => setCurrentQ(qi => qi - 1)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">← Back</button>
        )}
        {currentQ < content.questions.length - 1 ? (
          <button onClick={() => setCurrentQ(qi => qi + 1)} disabled={selected[currentQ] === null}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm transition-colors">Next →</button>
        ) : (
          <button onClick={handleSubmit} disabled={!allAnswered}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm transition-colors">
            {allAnswered ? 'Submit Quiz →' : `${selected.filter(s => s !== null).length}/${content.questions.length} answered`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Reading ───────────────────────────────────────────────────
function ReadingRunner({ assignmentId, content, alreadyComplete }: { assignmentId: string; content: ReadingContent; alreadyComplete: boolean }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-2">
        <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Passage</p>
        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line leading-relaxed">
          {content.passage}
        </div>
      </div>
      <QuizRunner
        assignmentId={assignmentId}
        content={{ kind: 'quiz', title: content.title, sessionId: content.sessionId, questions: content.questions }}
        alreadyComplete={alreadyComplete}
      />
    </div>
  )
}

// ── Flashcards ────────────────────────────────────────────────
function FlashcardsRunner({ assignmentId, content, alreadyComplete }: { assignmentId: string; content: FlashcardContent; alreadyComplete: boolean }) {
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<boolean[]>(Array(content.cards.length).fill(false))
  const [done, setDone] = useState(false)
  const [xpEarned, setXpEarned] = useState<number | null | 'pending'>('pending')
  const submittedRef = useRef(false)

  async function finish(latestKnown: boolean[]) {
    setDone(true)
    if (alreadyComplete || submittedRef.current) return
    submittedRef.current = true
    const score = latestKnown.filter(Boolean).length
    const result = await submitAssignment(assignmentId, { score, total: content.cards.length })
    setXpEarned(result?.xpEarned ?? null)
  }

  function handleKnow(didKnow: boolean) {
    const next = [...known]; next[cardIndex] = didKnow
    setKnown(next)
    if (cardIndex < content.cards.length - 1) {
      setCardIndex(i => i + 1); setFlipped(false)
    } else {
      finish(next)
    }
  }

  if (done) {
    const knownCount = known.filter(Boolean).length
    return (
      <div className="space-y-4">
        {!alreadyComplete && <CompletionBanner xpEarned={xpEarned} />}
        <div className={`rounded-2xl px-6 py-6 text-center space-y-2 ${knownCount === content.cards.length ? 'bg-yellow-50 border border-yellow-200' : 'bg-indigo-50 border border-indigo-200'}`}>
          <p className="text-xl font-bold mb-1">{knownCount === content.cards.length ? 'Perfect!' : 'Keep going!'}</p>
          <p className="text-2xl font-bold text-gray-900">{knownCount} / {content.cards.length}</p>
          <p className="text-sm text-gray-600">cards marked as known</p>
        </div>
        <button
          onClick={() => { setKnown(Array(content.cards.length).fill(false)); setCardIndex(0); setFlipped(false); setDone(false) }}
          className="w-full py-3.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          Study Again
        </button>
      </div>
    )
  }

  const card = content.cards[cardIndex]
  const knownCount = known.filter(Boolean).length
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{cardIndex + 1} of {content.cards.length}</span>
        <span className="text-green-600 font-medium">{knownCount} known ✓</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${(cardIndex / content.cards.length) * 100}%` }} />
      </div>
      <button onClick={() => setFlipped(f => !f)}
        className="w-full min-h-52 bg-white rounded-2xl border-2 border-gray-100 shadow-sm px-6 py-8 flex flex-col items-center justify-center gap-3 hover:border-indigo-200 hover:shadow-md transition-all">
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
      {flipped ? (
        <div className="flex gap-3">
          <button onClick={() => handleKnow(false)} className="flex-1 py-3.5 rounded-xl border-2 border-red-200 bg-red-50 text-red-600 font-semibold text-sm hover:bg-red-100 transition-colors">Still learning</button>
          <button onClick={() => handleKnow(true)} className="flex-1 py-3.5 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 font-semibold text-sm hover:bg-green-100 transition-colors">Got it ✓</button>
        </div>
      ) : (
        <button onClick={() => setFlipped(true)} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">Reveal Answer</button>
      )}
    </div>
  )
}

// ── Explain ───────────────────────────────────────────────────
function ExplainRunner({ assignmentId, content, alreadyComplete }: { assignmentId: string; content: ExplainContent; alreadyComplete: boolean }) {
  const [xpEarned, setXpEarned] = useState<number | null | 'pending'>(alreadyComplete ? null : 'pending')
  const [completed, setCompleted] = useState(alreadyComplete)
  const submittedRef = useRef(false)

  async function complete() {
    if (submittedRef.current) return
    submittedRef.current = true
    setCompleted(true)
    const result = await submitAssignment(assignmentId)
    setXpEarned(result?.xpEarned ?? null)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-4">
        {content.sections.map((s, i) => (
          <div key={i} className="space-y-1">
            <p className="text-sm font-semibold text-oxford">{s.heading}</p>
            <p className="text-sm text-gray-600 leading-relaxed">{s.content}</p>
          </div>
        ))}
      </div>
      {content.summary && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-4">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Key Takeaway</p>
          <p className="text-sm text-indigo-800 leading-relaxed">{content.summary}</p>
        </div>
      )}
      {completed ? (
        !alreadyComplete && <CompletionBanner xpEarned={xpEarned} />
      ) : (
        <button onClick={complete}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">
          Mark as Complete →
        </button>
      )}
    </div>
  )
}

// ── Study guide ───────────────────────────────────────────────
function StudyGuideRunner({ assignmentId, content, alreadyComplete }: { assignmentId: string; content: StudyGuideContent; alreadyComplete: boolean }) {
  const [openAnswers, setOpenAnswers] = useState<Set<number>>(new Set())
  const [xpEarned, setXpEarned] = useState<number | null | 'pending'>(alreadyComplete ? null : 'pending')
  const [completed, setCompleted] = useState(alreadyComplete)
  const submittedRef = useRef(false)

  async function complete() {
    if (submittedRef.current) return
    submittedRef.current = true
    setCompleted(true)
    const result = await submitAssignment(assignmentId)
    setXpEarned(result?.xpEarned ?? null)
  }

  return (
    <div className="space-y-4">
      {content.overview && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
          <p className="text-sm text-gray-700 leading-relaxed">{content.overview}</p>
        </div>
      )}
      {content.key_terms.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-3">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Key Terms</p>
          <div className="grid gap-2">
            {content.key_terms.map((t, i) => (
              <div key={i} className="flex gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
                <span className="font-semibold text-oxford shrink-0 min-w-24">{t.term}</span>
                <span className="text-gray-600">{t.definition}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {content.main_concepts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-4">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Main Concepts</p>
          {content.main_concepts.map((c, i) => (
            <div key={i} className="space-y-1">
              <p className="text-sm font-semibold text-oxford">{c.heading}</p>
              <p className="text-sm text-gray-600 leading-relaxed">{c.content}</p>
            </div>
          ))}
        </div>
      )}
      {content.remember.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-5 space-y-3">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Remember</p>
          <ul className="space-y-2">
            {content.remember.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-indigo-800"><span className="shrink-0">•</span>{tip}</li>
            ))}
          </ul>
        </div>
      )}
      {content.practice_questions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-3">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Practice Questions</p>
          {content.practice_questions.map((pq, i) => (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
              <button onClick={() => setOpenAnswers(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })}
                className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50 transition-colors">
                <p className="text-sm font-medium text-gray-800">{i + 1}. {pq.question}</p>
                <span className="text-gray-400 shrink-0 text-xs">{openAnswers.has(i) ? '▲' : '▼'}</span>
              </button>
              {openAnswers.has(i) && (
                <div className="px-4 pb-3 pt-1 bg-green-50 border-t border-gray-100">
                  <p className="text-sm text-green-800">{pq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {completed ? (
        !alreadyComplete && <CompletionBanner xpEarned={xpEarned} />
      ) : (
        <button onClick={complete}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">
          Mark as Complete →
        </button>
      )}
    </div>
  )
}
