'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { submitAssignment } from '@/lib/utils/submitAssignment'

const SUBJECTS = [
  { value: 'math', label: 'Math' },
  { value: 'science', label: 'Science' },
  { value: 'reading', label: 'Reading' },
  { value: 'history', label: 'History' },
  { value: 'social_studies', label: 'Social Studies' },
  { value: 'spelling', label: 'Spelling' },
]

interface Question {
  question: string
  options: [string, string, string, string]
}

interface GradeFeedback {
  correct_index: number
  explanation: string
  your_answer: number
}

type Stage = 'form' | 'loading' | 'quiz' | 'grading' | 'results'

interface Props {
  assignmentId?: string
  initialTopic?: string
  initialGrade?: number
  initialSubject?: string
  maxImageMb?: number
}

export default function QuizGenerator({ assignmentId, initialTopic, initialGrade, initialSubject, maxImageMb = 5 }: Props) {
  const [topic, setTopic] = useState(initialTopic ?? '')
  const [subject, setSubject] = useState(initialSubject ?? '')
  const [grade, setGrade] = useState<number | null>(initialGrade ?? null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState('image/jpeg')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>('form')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState<(number | null)[]>([])
  const [quizStartedAt, setQuizStartedAt] = useState<number | null>(null)

  const [score, setScore] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<GradeFeedback[] | null>(null)
  const [tabWarning, setTabWarning] = useState(false)
  const tabViolationsRef = useRef(0)

  const [xpEarned, setXpEarned] = useState<number | null>(null)
  const submittedRef = useRef(false)

  // Detect tab switches / window blur during the quiz
  useEffect(() => {
    if (stage !== 'quiz') return
    function onHide() {
      tabViolationsRef.current += 1
      setTabWarning(true)
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) onHide() })
    window.addEventListener('blur', onHide)
    return () => {
      document.removeEventListener('visibilitychange', () => { if (document.hidden) onHide() })
      window.removeEventListener('blur', onHide)
    }
  }, [stage])

  // Auto-generate if coming from an assignment or preview link with a pre-filled topic
  useEffect(() => {
    if (assignmentId && initialTopic && stage === 'form') {
      handleGenerate()
    } else if (initialTopic && initialGrade && !assignmentId && stage === 'form' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('auto') === '1') {
      handleGenerate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleImageSelect(file: File) {
    if (file.size > maxImageMb * 1024 * 1024) { setError(`Image must be under ${maxImageMb} MB.`); return }
    setImageMime(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      setImagePreview(dataUrl)
      setImageBase64(dataUrl.split(',')[1])
      setTopic('')
    }
    reader.readAsDataURL(file)
  }

  function clearImage() {
    setImagePreview(null)
    setImageBase64(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleGenerate() {
    if (!topic.trim() && !imageBase64) { setError('Enter a topic or upload a photo.'); return }
    setError(null)
    setStage('loading')

    const payload = imageBase64
      ? { imageBase64, mimeType: imageMime, subject: subject || undefined, grade: grade ?? undefined }
      : { topic: topic.trim(), subject: subject || undefined, grade: grade ?? undefined }

    const res = await fetch('/api/learning/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.message ?? 'Failed to generate quiz.'); setStage('form'); return }

    setSessionId(data.sessionId)
    setQuestions(data.questions)
    setSelected(Array(data.questions.length).fill(null))
    setCurrentQ(0)
    setQuizStartedAt(Date.now())
    setStage('quiz')
  }

  async function handleSubmit() {
    setStage('grading')
    const elapsedSeconds = quizStartedAt ? Math.floor((Date.now() - quizStartedAt) / 1000) : 0

    const res = await fetch('/api/learning/quiz/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, answers: selected, elapsedSeconds }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.message ?? 'Failed to submit quiz.')
      setStage('quiz')
      return
    }

    setScore(data.score)
    setTotal(data.total)
    setFeedback(data.feedback)
    setStage('results')

    if (assignmentId && !submittedRef.current) {
      submittedRef.current = true
      const result = await submitAssignment(assignmentId, { score: data.score, total: data.total, quizSessionId: sessionId ?? undefined })
      if (result) setXpEarned(result.xpEarned)
    }
  }

  function handleRetake() {
    setSelected(Array(questions.length).fill(null))
    setCurrentQ(0)
    setQuizStartedAt(Date.now())
    setError(null)
    setStage('quiz')
  }

  function handleReset() {
    setTopic(initialTopic ?? ''); setSubject(initialSubject ?? ''); setGrade(initialGrade ?? null); setError(null)
    setStage('form'); setQuestions([]); setSelected([]); setScore(null)
    setTotal(null); setFeedback(null); setCurrentQ(0); setSessionId(null)
    setQuizStartedAt(null); submittedRef.current = false; setXpEarned(null)
    clearImage()
  }

  const q = questions[currentQ]
  const allAnswered = selected.length > 0 && selected.every(s => s !== null)

  if (stage === 'form') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-6">
        {/* Photo upload */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Upload homework photo</label>
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Homework" className="w-full max-h-48 object-contain bg-gray-50" />
              <button
                onClick={clearImage}
                className="absolute top-2 right-2 bg-white/90 hover:bg-white border border-gray-200 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 rounded-xl py-6 text-center transition-colors group"
            >
              <div className="text-base font-semibold text-gray-400 mb-2">Upload</div>
              <p className="text-sm font-medium text-gray-500 group-hover:text-indigo-600">
                Tap to snap or upload a photo of homework
              </p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG up to {maxImageMb} MB</p>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(f) }}
          />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400 font-medium">or type a topic</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <div className="space-y-2">
          <textarea
            rows={2}
            placeholder='e.g. "Adding fractions with unlike denominators"'
            value={topic}
            onChange={e => { setTopic(e.target.value); if (e.target.value) clearImage() }}
            disabled={!!imageBase64}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none transition-colors disabled:opacity-40"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Subject <span className="text-gray-400 font-normal">(optional)</span></label>
          <div className="grid grid-cols-3 gap-2">
            {SUBJECTS.map(s => (
              <button key={s.value} type="button"
                onClick={() => setSubject(subject === s.value ? '' : s.value)}
                className={`text-left px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${subject === s.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Grade <span className="text-gray-400 font-normal">(optional)</span></label>
          <div className="flex flex-wrap gap-2">
            {[1,2,3,4,5,6,7,8].map(g => (
              <button key={g} type="button" onClick={() => setGrade(grade === g ? null : g)}
                className={`w-10 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${grade === g ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

        <button onClick={handleGenerate} disabled={!topic.trim() && !imageBase64}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-base transition-colors">
          Generate Quiz →
        </button>
      </div>
    )
  }

  if (stage === 'loading') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-gray-600">Writing your quiz…</p>
        <p className="text-xs text-gray-400">{imageBase64 ? 'Reading your homework photo…' : 'Usually takes about 5 seconds'}</p>
      </div>
    )
  }

  if (stage === 'grading') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-gray-600">Grading your quiz…</p>
      </div>
    )
  }

  if (stage === 'quiz') {
    return (
      <div className="space-y-4">
        {tabWarning && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-sm font-bold text-amber-600 shrink-0">!</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">You left the quiz!</p>
              <p className="text-xs text-amber-700 mt-0.5">Switching tabs or windows is recorded. Stay on this page to complete your quiz.</p>
            </div>
            <button onClick={() => setTabWarning(false)} className="text-amber-600 hover:text-amber-800 text-lg leading-none shrink-0">×</button>
          </div>
        )}
        {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
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
                className={`w-full text-left px-5 py-3.5 rounded-2xl border-2 text-sm transition-all font-medium ${isSel ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}>
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
              {allAnswered ? 'Submit Quiz →' : `${selected.filter(s => s !== null).length}/${questions.length} answered`}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (stage === 'results' && score !== null && total !== null && feedback) {
    const pct = score / total
    return (
      <div className="space-y-4">
        {assignmentId && (
          <div className="bg-indigo-600 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-semibold text-sm">Quest Complete!</p>
              <p className="text-indigo-200 text-xs">{xpEarned != null ? `+${xpEarned} XP earned` : 'Submitting…'}</p>
            </div>
            <button onClick={() => { window.location.href = '/classroom/student' }}
              className="bg-white text-indigo-600 text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap hover:bg-indigo-50 transition-colors shrink-0">
              Back to Dashboard →
            </button>
          </div>
        )}
        <div className={`rounded-2xl px-6 py-6 text-center space-y-1 ${pct === 1 ? 'bg-yellow-50 border border-yellow-200' : pct >= 0.8 ? 'bg-green-50 border border-green-200' : pct >= 0.6 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
          <p className="text-xl font-bold mb-2">{pct === 1 ? 'Perfect!' : pct >= 0.8 ? 'Great job!' : pct >= 0.6 ? 'Good effort!' : 'Keep going!'}</p>
          <p className="text-2xl font-bold text-gray-900">{score} / {total}</p>
          <p className="text-sm font-medium text-gray-600">{pct === 1 ? 'Perfect score!' : pct >= 0.8 ? 'Great work!' : pct >= 0.6 ? 'Good effort!' : 'Keep studying!'}</p>
        </div>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const fb = feedback[i]
            const isCorrect = fb.your_answer === fb.correct_index
            return (
              <div key={i} className={`bg-white rounded-2xl border-2 px-5 py-4 space-y-2 ${isCorrect ? 'border-green-200' : 'border-red-200'}`}>
                <p className="text-sm font-semibold text-gray-800">{i + 1}. {q.question}</p>
                <div className="flex gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{isCorrect ? '✓ Correct' : `✗ You chose: ${q.options[fb.your_answer]}`}</span>
                  {!isCorrect && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">✓ {q.options[fb.correct_index]}</span>}
                </div>
                <p className="text-xs text-gray-500 italic">{fb.explanation}</p>
              </div>
            )
          })}
        </div>
        <div className="flex flex-col gap-3 pt-2">
          <button onClick={handleRetake}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">Retake Quiz</button>
          <button onClick={handleReset} className="w-full py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">Try a New Topic</button>
          {!assignmentId && (
            <Link href="/create?mode=learning" className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm text-center transition-colors block">Turn this into a Learning Story →</Link>
          )}
        </div>
      </div>
    )
  }

  return null
}
