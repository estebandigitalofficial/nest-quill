'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { submitAssignment } from '@/lib/utils/submitAssignment'
import PhotoUpload from '@/components/learning/PhotoUpload'

interface Card { front: string; back: string }

interface InitialImage { base64: string; mimeType: string; preview: string }

interface Props {
  assignmentId?: string
  initialTopic?: string
  initialGrade?: number
  initialImage?: InitialImage
  thinkFirstEnabled?: boolean
  maxImageMb?: number
}

export default function FlashcardGenerator({ assignmentId, initialTopic, initialGrade, initialImage, thinkFirstEnabled = true, maxImageMb = 5 }: Props) {
  const [topic, setTopic] = useState(initialTopic ?? '')
  const [grade, setGrade] = useState<number | null>(initialGrade ?? null)
  const [imageBase64, setImageBase64] = useState<string | null>(initialImage?.base64 ?? null)
  const [imageMime, setImageMime] = useState(initialImage?.mimeType ?? 'image/jpeg')
  const [imagePreview, setImagePreview] = useState<string | null>(initialImage?.preview ?? null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<Card[] | null>(null)
  const [flipped, setFlipped] = useState<Set<number>>(new Set())
  const [known, setKnown] = useState<Set<number>>(new Set())

  const [xpEarned, setXpEarned] = useState<number | null>(null)
  const submittedRef = useRef(false)

  const generateCards = useCallback(async (params: {
    topic?: string; grade?: number; imageBase64?: string; mimeType?: string
  }) => {
    setError(null); setLoading(true); setCards(null)
    try {
      const res = await fetch('/api/learning/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      setLoading(false)
      if (!res.ok) { setError(data.message); return }
      setCards(data.cards)
      setFlipped(new Set())
      setKnown(new Set())
    } catch {
      setLoading(false)
      setError('Something went wrong.')
    }
  }, [])

  // Auto-submit when cards are shown
  useEffect(() => {
    if (cards && assignmentId && !submittedRef.current) {
      submittedRef.current = true
      submitAssignment(assignmentId).then(res => {
        if (res) setXpEarned(res.xpEarned)
      })
    }
  }, [cards, assignmentId])

  // Auto-generate from assignment, initial image, or preview link
  useEffect(() => {
    if (assignmentId && initialTopic && !cards && !loading) {
      generateCards({ topic: initialTopic.trim(), grade: initialGrade ?? undefined })
    } else if (initialTopic && initialGrade && !assignmentId && !cards && !loading && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('auto') === '1') {
      generateCards({ topic: initialTopic.trim(), grade: initialGrade })
    } else if (initialImage && !cards && !loading) {
      generateCards({ imageBase64: initialImage.base64, mimeType: initialImage.mimeType, grade: initialGrade ?? undefined })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleGenerate() {
    if (!topic.trim() && !imageBase64) { setError('Enter a topic or upload a photo.'); return }
    generateCards({
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

  function toggle(i: number) {
    setFlipped(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  function markKnown(i: number) {
    setKnown(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  function reset() {
    setCards(null); setTopic(initialTopic ?? ''); setGrade(initialGrade ?? null)
    clearImage(); submittedRef.current = false; setXpEarned(null)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-gray-600">
          {imageBase64 || initialImage ? 'Reading your photo…' : 'Creating your flashcards…'}
        </p>
      </div>
    )
  }

  if (cards) {
    const knownCount = known.size
    return (
      <div className="space-y-4">
        {/* Think First nudge */}
        {thinkFirstEnabled && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <span className="text-sm font-bold text-amber-600 shrink-0 mt-0.5">!</span>
            <p className="text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold">Think first, then flip.</span> Try to recall the answer before revealing the back of each card — it makes your memory stronger.
            </p>
          </div>
        )}

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

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">{cards.length} cards</p>
          <p className="text-xs text-indigo-600 font-medium">{knownCount} / {cards.length} known ✓</p>
        </div>

        <div className="space-y-3">
          {cards.map((card, i) => (
            <div key={i} className={`rounded-2xl border-2 overflow-hidden transition-all ${known.has(i) ? 'border-green-300 opacity-60' : 'border-gray-100'}`}>
              <button
                onClick={() => toggle(i)}
                className="w-full text-left px-5 py-4 bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Front</p>
                    <p className="text-sm font-semibold text-gray-800">{card.front}</p>
                  </div>
                  <span className="text-gray-400 text-xs shrink-0 mt-1">
                    {flipped.has(i) ? '▲' : <span className="text-indigo-400 font-medium">reveal ▼</span>}
                  </span>
                </div>
              </button>
              {flipped.has(i) && (
                <div className="px-5 py-4 bg-indigo-50 border-t border-indigo-100">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Back</p>
                  <p className="text-sm text-indigo-800">{card.back}</p>
                  <button
                    onClick={() => markKnown(i)}
                    className={`mt-3 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${known.has(i) ? 'bg-green-100 text-green-700' : 'bg-white text-gray-500 hover:bg-green-50 hover:text-green-600 border border-gray-200'}`}
                  >
                    {known.has(i) ? '✓ Known' : 'Mark as known'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={reset}
          className="w-full py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
          New Flashcards
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-5">
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">Topic</label>
        <input type="text" placeholder='e.g. "Solar System" or "Fractions"'
          value={topic}
          onChange={e => { setTopic(e.target.value); if (e.target.value) clearImage() }}
          onKeyDown={e => e.key === 'Enter' && handleGenerate()}
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
        <label className="block text-sm font-semibold text-gray-700">Grade <span className="text-gray-400 font-normal">(optional)</span></label>
        <div className="flex flex-wrap gap-2">
          {[1,2,3,4,5,6,7,8].map(g => (
            <button key={g} type="button" onClick={() => setGrade(grade === g ? null : g)}
              className={`w-10 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${grade === g ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>{g}</button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      <button onClick={handleGenerate} disabled={!topic.trim() && !imageBase64}
        className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-base transition-colors">
        Generate Flashcards →
      </button>
    </div>
  )
}
