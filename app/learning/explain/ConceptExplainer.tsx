'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { submitAssignment } from '@/lib/utils/submitAssignment'
import PhotoUpload from '@/components/learning/PhotoUpload'
import NudgePrompt from '@/components/learning/NudgePrompt'

interface Explanation {
  summary: string
  analogy: string
  key_points: string[]
  fun_fact: string
  try_this: string
}

interface InitialImage { base64: string; mimeType: string; preview: string }

interface Props {
  assignmentId?: string
  initialTopic?: string
  initialGrade?: number
  initialImage?: InitialImage
  thinkFirstEnabled?: boolean
  teachBackEnabled?: boolean
  nudgesEnabled?: boolean
}

export default function ConceptExplainer({ assignmentId, initialTopic, initialGrade, initialImage, thinkFirstEnabled = true, teachBackEnabled = true, nudgesEnabled = true }: Props) {
  const [topic, setTopic] = useState(initialTopic ?? '')
  const [grade, setGrade] = useState<number | null>(initialGrade ?? null)
  const [imageBase64, setImageBase64] = useState<string | null>(initialImage?.base64 ?? null)
  const [imageMime, setImageMime] = useState(initialImage?.mimeType ?? 'image/jpeg')
  const [imagePreview, setImagePreview] = useState<string | null>(initialImage?.preview ?? null)
  const [thinkFirst, setThinkFirst] = useState('')
  const [teachBack, setTeachBack] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Explanation | null>(null)

  const [xpEarned, setXpEarned] = useState<number | null>(null)
  const submittedRef = useRef(false)

  const explain = useCallback(async (params: {
    topic?: string; grade?: number; imageBase64?: string; mimeType?: string
  }) => {
    setError(null); setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/learning/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      setLoading(false)
      if (!res.ok) { setError(data.message); return }
      setResult(data)
    } catch {
      setLoading(false)
      setError('Something went wrong.')
    }
  }, [])

  // Auto-submit when explanation is shown
  useEffect(() => {
    if (result && assignmentId && !submittedRef.current) {
      submittedRef.current = true
      submitAssignment(assignmentId).then(res => {
        if (res) setXpEarned(res.xpEarned)
      })
    }
  }, [result, assignmentId])

  // Auto-explain from assignment or initial image
  useEffect(() => {
    if (assignmentId && initialTopic && !result && !loading) {
      explain({ topic: initialTopic.trim(), grade: initialGrade ?? undefined })
    } else if (initialImage && !result && !loading) {
      explain({ imageBase64: initialImage.base64, mimeType: initialImage.mimeType, grade: initialGrade ?? undefined })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleExplain() {
    if (!topic.trim() && !imageBase64) { setError('Enter a topic or upload a photo.'); return }
    explain({
      topic: imageBase64 ? undefined : topic.trim(),
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

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-5">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">What should we explain?</label>
          <input type="text" placeholder='e.g. "How does photosynthesis work?" or "What is democracy?"'
            value={topic}
            onChange={e => { setTopic(e.target.value); if (e.target.value) clearImage() }}
            onKeyDown={e => e.key === 'Enter' && handleExplain()}
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
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Grade <span className="text-gray-400 font-normal">(optional — helps tune the explanation)</span></label>
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
        <button onClick={handleExplain} disabled={(!topic.trim() && !imageBase64) || loading}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-base transition-colors">
          {loading ? 'Explaining…' : 'Explain It →'}
        </button>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">
            {imageBase64 || initialImage ? 'Reading your photo…' : 'Building your explanation…'}
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-3">
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

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-2">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">The Simple Version</p>
            <p className="text-base text-gray-800 leading-relaxed">{result.summary}</p>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-5 space-y-2">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Think of it like this…</p>
            <p className="text-sm text-indigo-800 leading-relaxed italic">{result.analogy}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 space-y-3">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Key Points</p>
            <ul className="space-y-2">
              {result.key_points.map((pt, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="text-indigo-400 font-bold shrink-0 mt-0.5">{i + 1}.</span>
                  {pt}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-6 py-5 space-y-2">
            <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest">Fun Fact</p>
            <p className="text-sm text-gray-700 leading-relaxed">{result.fun_fact}</p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-5 space-y-2">
            <p className="text-xs font-bold text-green-600 uppercase tracking-widest">Try This at Home</p>
            <p className="text-sm text-gray-700 leading-relaxed">{result.try_this}</p>
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

          <button onClick={() => { setResult(null); setTopic(initialTopic ?? ''); setGrade(initialGrade ?? null); clearImage(); setThinkFirst(''); setTeachBack(''); submittedRef.current = false; setXpEarned(null) }}
            className="w-full py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
            Explain Something Else
          </button>
        </div>
      )}
    </div>
  )
}
