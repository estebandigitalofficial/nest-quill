'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import TriviaMode from './TriviaMode'
import NudgePrompt from '@/components/learning/NudgePrompt'

const FlashcardGenerator = dynamic(() => import('@/app/learning/flashcards/FlashcardGenerator'), { ssr: false })
const ConceptExplainer = dynamic(() => import('@/app/learning/explain/ConceptExplainer'), { ssr: false })
const StudyGuideGenerator = dynamic(() => import('@/app/learning/study-guide/StudyGuideGenerator'), { ssr: false })
const SpellingPractice = dynamic(() => import('@/app/learning/spelling/SpellingPractice'), { ssr: false })

interface UploadedImage {
  base64: string
  mimeType: string
  preview: string
}

type Activity = 'flashcards' | 'explain' | 'study-guide' | 'spelling' | 'trivia'

const ACTIVITIES: { id: Activity; emoji: string; label: string; desc: string }[] = [
  { id: 'flashcards', emoji: '🃏', label: 'Flashcards', desc: '10 study cards' },
  { id: 'explain', emoji: '💡', label: 'Explain It', desc: 'Simple explanation' },
  { id: 'study-guide', emoji: '📋', label: 'Study Guide', desc: 'Key terms & concepts' },
  { id: 'spelling', emoji: '✏️', label: 'Spelling', desc: 'Extract & practice words' },
  { id: 'trivia', emoji: '🎯', label: 'Trivia Game', desc: 'Rapid-fire questions' },
]

export default function ScanHomeworkClient() {
  const [image, setImage] = useState<UploadedImage | null>(null)
  const [grade, setGrade] = useState<number | null>(null)
  const [activity, setActivity] = useState<Activity | null>(null)
  const [spellingWords, setSpellingWords] = useState<string[] | null>(null)
  const [extractingSpelling, setExtractingSpelling] = useState(false)
  const [spellingError, setSpellingError] = useState<string | null>(null)
  const [fileSizeError, setFileSizeError] = useState(false)
  const [thinkFirst, setThinkFirst] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setFileSizeError(true)
      e.target.value = ''
      return
    }
    setFileSizeError(false)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      const mimeType = dataUrl.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      setImage({ base64, mimeType, preview: dataUrl })
      setActivity(null)
      setSpellingWords(null)
      setFileSizeError(false)
      setThinkFirst('')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleActivitySelect(id: Activity) {
    if (id === 'spelling') {
      setExtractingSpelling(true)
      setSpellingError(null)
      try {
        const res = await fetch('/api/learning/extract-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: image!.base64, mimeType: image!.mimeType, mode: 'spelling' }),
        })
        const data = await res.json()
        setExtractingSpelling(false)
        if (!res.ok || !data.text) {
          setSpellingError(data.message ?? 'Could not extract words from this image.')
          return
        }
        const lines = (data.text as string).split('\n').map((w: string) => w.trim()).filter((w: string) => w.length > 0)
        setSpellingWords(lines)
        setActivity('spelling')
      } catch {
        setExtractingSpelling(false)
        setSpellingError('Failed to extract words.')
      }
      return
    }
    setActivity(id)
  }

  function resetActivity() {
    setActivity(null)
    setSpellingWords(null)
    setSpellingError(null)
    setThinkFirst('')
  }

  // ── Activity view ─────────────────────────────────────────────────────────
  if (activity && image) {
    const actInfo = ACTIVITIES.find(a => a.id === activity)!
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.preview} alt="Homework" className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{actInfo.emoji} {actInfo.label}</p>
          </div>
          <button onClick={resetActivity} className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap shrink-0">← Change</button>
        </div>

        {activity === 'flashcards' && (
          <FlashcardGenerator initialImage={image} initialGrade={grade ?? undefined} />
        )}
        {activity === 'explain' && (
          <ConceptExplainer initialImage={image} initialGrade={grade ?? undefined} />
        )}
        {activity === 'study-guide' && (
          <StudyGuideGenerator initialImage={image} initialGrade={grade ?? undefined} />
        )}
        {activity === 'spelling' && spellingWords && (
          <SpellingPractice initialWords={spellingWords} />
        )}
        {activity === 'trivia' && (
          <TriviaMode initialImage={image} grade={grade} onReset={resetActivity} />
        )}
      </div>
    )
  }

  // ── Upload / activity picker ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Photo upload zone */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        {image ? (
          <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-200 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.preview} alt="Homework" className="w-full max-h-56 object-contain" />
            <button
              onClick={() => { setImage(null); setActivity(null); setSpellingWords(null) }}
              className="absolute top-3 right-3 bg-white/90 border border-gray-200 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm hover:bg-white transition-colors"
            >
              Change photo
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setFileSizeError(false); fileRef.current?.click() }}
            className={`w-full border-2 border-dashed rounded-2xl py-12 text-center transition-colors group ${fileSizeError ? 'border-red-300 bg-red-50/30' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30'}`}
          >
            <div className="text-5xl mb-3">📷</div>
            <p className="text-base font-semibold text-gray-600 group-hover:text-indigo-700 transition-colors">
              Tap to snap or upload a homework photo
            </p>
            {fileSizeError ? (
              <p className="text-sm text-red-500 font-medium mt-1">Image too large — please use a photo under 5 MB</p>
            ) : (
              <>
                <p className="text-sm text-gray-400 mt-1">Works with worksheets, textbooks, notes</p>
                <p className="text-xs text-gray-300 mt-2">JPG, PNG up to 5 MB</p>
              </>
            )}
          </button>
        )}
      </div>

      {/* Grade picker */}
      {image && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">Grade <span className="text-gray-400 font-normal">(optional)</span></p>
          <div className="flex flex-wrap gap-2">
            {[1,2,3,4,5,6,7,8].map(g => (
              <button key={g} type="button" onClick={() => setGrade(grade === g ? null : g)}
                className={`w-10 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${grade === g ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Activity picker */}
      {image && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">What do you want to do with this?</p>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              💭 Think first: What do you already know or what would you try first?
            </label>
            <textarea
              value={thinkFirst}
              onChange={e => setThinkFirst(e.target.value)}
              placeholder="Your attempt (optional)"
              rows={2}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
            />
          </div>

          <NudgePrompt />
          {spellingError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{spellingError}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ACTIVITIES.map(act => (
              <button
                key={act.id}
                onClick={() => handleActivitySelect(act.id)}
                disabled={extractingSpelling}
                className="flex flex-col items-start gap-2 bg-white border-2 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50/30 rounded-2xl px-4 py-4 text-left transition-all group disabled:opacity-50"
              >
                <span className="text-2xl">{act.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-oxford group-hover:text-indigo-700 transition-colors">
                    {act.id === 'spelling' && extractingSpelling ? 'Extracting…' : act.label}
                  </p>
                  <p className="text-xs text-gray-400">{act.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-600">Want a quiz instead?</p>
              <p className="text-xs text-gray-400">Full 5-question quiz with grading</p>
            </div>
            <a
              href="/learning/quiz"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 whitespace-nowrap shrink-0"
            >
              Open Quiz →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
