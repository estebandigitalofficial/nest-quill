'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { submitAssignment } from '@/lib/utils/submitAssignment'
import PhotoUpload from '@/components/learning/PhotoUpload'
import NudgePrompt from '@/components/learning/NudgePrompt'

const SUBJECTS = ['Math','Science','Reading','History','Social Studies','Spelling','English','Art']

interface StudyGuide {
  title: string
  overview: string
  key_terms: { term: string; definition: string }[]
  main_concepts: { heading: string; content: string }[]
  remember: string[]
  practice_questions: { question: string; answer: string }[]
}

interface InitialImage { base64: string; mimeType: string; preview: string }

interface Props {
  assignmentId?: string
  initialTopic?: string
  initialGrade?: number
  initialSubject?: string
  initialImage?: InitialImage
  thinkFirstEnabled?: boolean
  teachBackEnabled?: boolean
  nudgesEnabled?: boolean
  maxImageMb?: number
}

export default function StudyGuideGenerator({ assignmentId, initialTopic, initialGrade, initialSubject, initialImage, thinkFirstEnabled = true, teachBackEnabled = true, nudgesEnabled = true, maxImageMb = 5 }: Props) {
  const [topic, setTopic] = useState(initialTopic ?? '')
  const [subject, setSubject] = useState(initialSubject ?? '')
  const [grade, setGrade] = useState<number | null>(initialGrade ?? null)
  const [imageBase64, setImageBase64] = useState<string | null>(initialImage?.base64 ?? null)
  const [imageMime, setImageMime] = useState(initialImage?.mimeType ?? 'image/jpeg')
  const [imagePreview, setImagePreview] = useState<string | null>(initialImage?.preview ?? null)
  const [thinkFirst, setThinkFirst] = useState('')
  const [teachBack, setTeachBack] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [guide, setGuide] = useState<StudyGuide | null>(null)
  const [openAnswers, setOpenAnswers] = useState<Set<number>>(new Set())

  const [xpEarned, setXpEarned] = useState<number | null>(null)
  const submittedRef = useRef(false)

  const generateGuide = useCallback(async (params: {
    topic?: string; subject?: string; grade?: number; imageBase64?: string; mimeType?: string
  }) => {
    setError(null); setLoading(true); setGuide(null)
    try {
      const res = await fetch('/api/learning/study-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      setLoading(false)
      if (!res.ok) { setError(data.message); return }
      setGuide(data)
      setOpenAnswers(new Set())
    } catch {
      setLoading(false)
      setError('Something went wrong.')
    }
  }, [])

  // Auto-submit when guide is shown
  useEffect(() => {
    if (guide && assignmentId && !submittedRef.current) {
      submittedRef.current = true
      submitAssignment(assignmentId).then(res => {
        if (res) setXpEarned(res.xpEarned)
      })
    }
  }, [guide, assignmentId])

  // Auto-generate from assignment or initial image
  useEffect(() => {
    if (assignmentId && initialTopic && !guide && !loading) {
      generateGuide({ topic: initialTopic.trim(), subject: initialSubject, grade: initialGrade ?? undefined })
    } else if (initialImage && !guide && !loading) {
      generateGuide({ imageBase64: initialImage.base64, mimeType: initialImage.mimeType, grade: initialGrade ?? undefined })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleGenerate() {
    if (!topic.trim() && !imageBase64) { setError('Enter a topic or upload a photo.'); return }
    generateGuide({
      topic: imageBase64 ? undefined : topic.trim(),
      subject: subject || undefined,
      grade: grade ?? undefined,
      imageBase64: imageBase64 ?? undefined,
      mimeType: imageMime,
    })
  }

  function handleImageSelect(base64: string, mimeType: string, preview: string) {
    setImageBase64(base64); setImageMime(mimeType); setImagePreview(preview); setTopic('')
  }

  function clearImage() {
    setImageBase64(null); setImagePreview(null)
  }

  function toggleAnswer(i: number) {
    setOpenAnswers(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-gray-600">
          {imageBase64 || initialImage ? 'Reading your photo…' : 'Building your study guide…'}
        </p>
      </div>
    )
  }

  if (guide) {
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

        <div className="bg-oxford rounded-2xl px-6 py-5 text-white">
          <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">Study Guide{grade ? ` · Grade ${grade}` : ''}</p>
          <h2 className="font-serif text-xl">{guide.title}</h2>
          <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>{guide.overview}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-3">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Key Terms</p>
          <div className="grid gap-2">
            {guide.key_terms.map((t, i) => (
              <div key={i} className="flex gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
                <span className="font-semibold text-oxford shrink-0 min-w-24">{t.term}</span>
                <span className="text-gray-600">{t.definition}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-4">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Main Concepts</p>
          {guide.main_concepts.map((c, i) => (
            <div key={i} className="space-y-1">
              <p className="text-sm font-semibold text-oxford">{c.heading}</p>
              <p className="text-sm text-gray-600 leading-relaxed">{c.content}</p>
            </div>
          ))}
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-5 space-y-3">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Remember</p>
          <ul className="space-y-2">
            {guide.remember.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-indigo-800">
                <span className="shrink-0">•</span>{tip}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-3">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Practice Questions</p>
          {guide.practice_questions.map((pq, i) => (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
              <button onClick={() => toggleAnswer(i)}
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

        {teachBackEnabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-amber-800">Explain it back</p>
              <p className="text-xs text-amber-700 mt-0.5">In your own words, what did you learn?</p>
            </div>
            <textarea
              value={teachBack}
              onChange={e => setTeachBack(e.target.value)}
              placeholder="Type your explanation here…"
              rows={3}
              className="w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
            />
          </div>
        )}

        <button onClick={() => { setGuide(null); setTopic(initialTopic ?? ''); setSubject(initialSubject ?? ''); setGrade(initialGrade ?? null); clearImage(); setThinkFirst(''); setTeachBack(''); submittedRef.current = false; setXpEarned(null) }}
          className="w-full py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
          New Study Guide
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-6">
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">Topic</label>
        <input type="text" placeholder='e.g. "The Water Cycle" or "World War II"'
          value={topic} onChange={e => { setTopic(e.target.value); if (e.target.value) clearImage() }}
          disabled={!!imageBase64}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:opacity-40" />
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <PhotoUpload
          imagePreview={imagePreview}
          onSelect={handleImageSelect}
          onClear={clearImage}
          label="Upload homework photo"
          maxSizeMb={maxImageMb}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">Subject <span className="text-gray-400 font-normal">(optional)</span></label>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map(s => (
            <button key={s} type="button" onClick={() => setSubject(subject === s ? '' : s)}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${subject === s ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
              {s}
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
      {thinkFirstEnabled && (
        <div className="space-y-2 pt-1">
          <label className="block text-sm font-semibold text-gray-700">
            Think first: What do you already know or what would you try first?
          </label>
          <textarea
            value={thinkFirst}
            onChange={e => setThinkFirst(e.target.value)}
            placeholder="Your attempt (optional)"
            rows={2}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
          />
        </div>
      )}
      {nudgesEnabled && <NudgePrompt />}
      {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      <button onClick={handleGenerate} disabled={!topic.trim() && !imageBase64}
        className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-base transition-colors">
        Generate Study Guide →
      </button>
    </div>
  )
}
