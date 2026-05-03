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

const ACTIVITIES: { id: Activity; label: string; desc: string; icon: string; color: string; iconBg: string }[] = [
  { id: 'flashcards', label: 'Flashcards', desc: '10 study cards', icon: 'F', color: 'border-violet-300 hover:border-violet-400 hover:bg-violet-50/50', iconBg: 'bg-violet-500' },
  { id: 'explain', label: 'Explain It', desc: 'Simple explanation', icon: '!', color: 'border-amber-300 hover:border-amber-400 hover:bg-amber-50/50', iconBg: 'bg-amber-500' },
  { id: 'study-guide', label: 'Study Guide', desc: 'Key terms & concepts', icon: 'S', color: 'border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50/50', iconBg: 'bg-emerald-500' },
  { id: 'spelling', label: 'Spelling', desc: 'Extract & practice words', icon: 'A', color: 'border-pink-300 hover:border-pink-400 hover:bg-pink-50/50', iconBg: 'bg-pink-500' },
  { id: 'trivia', label: 'Trivia Game', desc: 'Rapid-fire questions', icon: '?', color: 'border-rose-300 hover:border-rose-400 hover:bg-rose-50/50', iconBg: 'bg-rose-500' },
]

interface ScanHomeworkClientProps {
  triviaEnabled: boolean
  thinkFirstEnabled: boolean
  teachBackEnabled: boolean
  nudgesEnabled: boolean
  maxImageMb: number
}

export default function ScanHomeworkClient({ triviaEnabled, thinkFirstEnabled, teachBackEnabled, nudgesEnabled, maxImageMb }: ScanHomeworkClientProps) {
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
    if (file.size > maxImageMb * 1024 * 1024) {
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
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{actInfo.label}</p>
          </div>
          <button onClick={resetActivity} className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap shrink-0">← Change</button>
        </div>

        {activity === 'flashcards' && (
          <FlashcardGenerator initialImage={image} initialGrade={grade ?? undefined} thinkFirstEnabled={thinkFirstEnabled} maxImageMb={maxImageMb} />
        )}
        {activity === 'explain' && (
          <ConceptExplainer initialImage={image} initialGrade={grade ?? undefined} thinkFirstEnabled={thinkFirstEnabled} teachBackEnabled={teachBackEnabled} nudgesEnabled={nudgesEnabled} maxImageMb={maxImageMb} />
        )}
        {activity === 'study-guide' && (
          <StudyGuideGenerator initialImage={image} initialGrade={grade ?? undefined} thinkFirstEnabled={thinkFirstEnabled} teachBackEnabled={teachBackEnabled} nudgesEnabled={nudgesEnabled} maxImageMb={maxImageMb} />
        )}
        {activity === 'spelling' && spellingWords && (
          <SpellingPractice initialWords={spellingWords} nudgesEnabled={nudgesEnabled} maxImageMb={maxImageMb} />
        )}
        {activity === 'trivia' && triviaEnabled && (
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
            className={`w-full border-2 border-dashed rounded-2xl py-12 text-center transition-all group ${fileSizeError ? 'border-red-300 bg-red-50/30' : 'border-rose-300 hover:border-rose-400 bg-gradient-to-br from-rose-50/50 to-violet-50/50 hover:from-rose-50 hover:to-violet-50'}`}
          >
            <div className="w-16 h-16 bg-gradient-to-br from-rose-500 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-200/50 group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-7 h-7">
                <path d="M3 9V6a3 3 0 013-3h3M21 9V6a3 3 0 00-3-3h-3M3 15v3a3 3 0 003 3h3M21 15v3a3 3 0 01-3 3h-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-base font-bold text-gray-700 group-hover:text-rose-700 transition-colors">
              Tap to scan your homework
            </p>
            {fileSizeError ? (
              <p className="text-sm text-red-500 font-medium mt-1">Image too large — please use a photo under {maxImageMb} MB</p>
            ) : (
              <>
                <p className="text-sm text-gray-400 mt-1">Worksheets, textbooks, handwritten notes</p>
                <p className="text-xs text-gray-300 mt-2">JPG, PNG up to {maxImageMb} MB</p>
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

          {thinkFirstEnabled && (
            <div className="space-y-1.5">
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
          {spellingError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{spellingError}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ACTIVITIES.filter(a => a.id !== 'trivia' || triviaEnabled).map(act => (
              <button
                key={act.id}
                onClick={() => handleActivitySelect(act.id)}
                disabled={extractingSpelling}
                className={`flex flex-col items-start gap-3 bg-white border-2 ${act.color} rounded-2xl px-4 py-4 text-left transition-all group disabled:opacity-50 hover:shadow-md hover:-translate-y-0.5`}
              >
                <div className={`w-9 h-9 ${act.iconBg} rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm`}>
                  {act.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-oxford transition-colors">
                    {act.id === 'spelling' && extractingSpelling ? 'Extracting...' : act.label}
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
