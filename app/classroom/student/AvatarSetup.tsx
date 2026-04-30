'use client'

import { useState } from 'react'

const CHARACTERS = [
  { name: 'Fox' },
  { name: 'Lion' },
  { name: 'Wolf' },
  { name: 'Tiger' },
  { name: 'Bear' },
  { name: 'Butterfly' },
  { name: 'Eagle' },
  { name: 'Dolphin' },
  { name: 'Wizard' },
  { name: 'Astronaut' },
  { name: 'Scientist' },
  { name: 'Hero' },
]

const COLORS: { value: string; bg: string; ring: string }[] = [
  { value: 'indigo',  bg: 'bg-indigo-500',  ring: 'ring-indigo-500' },
  { value: 'violet',  bg: 'bg-violet-500',  ring: 'ring-violet-500' },
  { value: 'rose',    bg: 'bg-rose-500',    ring: 'ring-rose-500' },
  { value: 'amber',   bg: 'bg-amber-500',   ring: 'ring-amber-500' },
  { value: 'emerald', bg: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { value: 'sky',     bg: 'bg-sky-500',     ring: 'ring-sky-500' },
  { value: 'orange',  bg: 'bg-orange-500',  ring: 'ring-orange-500' },
  { value: 'pink',    bg: 'bg-pink-500',    ring: 'ring-pink-500' },
]

interface Props {
  onComplete: (profile: { display_name: string; avatar_emoji: string; avatar_color: string }) => void
}

export default function AvatarSetup({ onComplete }: Props) {
  const [step, setStep] = useState<'character' | 'color' | 'name'>('character')
  const [emoji, setEmoji] = useState('Fox')
  const [color, setColor] = useState('indigo')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedColor = COLORS.find(c => c.value === color) ?? COLORS[0]

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const res = await fetch('/api/classroom/student/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: name.trim(), avatar_emoji: emoji, avatar_color: color }),
    })
    if (res.ok) {
      onComplete({ display_name: name.trim(), avatar_emoji: emoji, avatar_color: color })
    }
    setSaving(false)
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Preview */}
        <div className="text-center mb-8">
          <div className={`w-24 h-24 ${selectedColor.bg} rounded-3xl flex items-center justify-center text-5xl mx-auto mb-3 shadow-lg`}>
            {emoji}
          </div>
          <p className="font-serif text-2xl text-oxford">{name || 'Your Hero'}</p>
          <p className="text-sm text-charcoal-light mt-1">Level 1 Explorer</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-6">

          {step === 'character' && (
            <div className="space-y-4">
              <p className="font-semibold text-oxford text-center">Pick your character</p>
              <div className="grid grid-cols-4 gap-3">
                {CHARACTERS.map(c => (
                  <button key={c.name} onClick={() => setEmoji(c.name)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all ${emoji === c.name ? 'border-indigo-500 bg-indigo-50 scale-105' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="text-sm font-bold text-gray-600">{c.name.charAt(0)}</span>
                    <span className="text-[10px] text-gray-500 font-medium">{c.name}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep('color')}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">
                Choose color →
              </button>
            </div>
          )}

          {step === 'color' && (
            <div className="space-y-4">
              <p className="font-semibold text-oxford text-center">Pick your color</p>
              <div className="grid grid-cols-4 gap-3">
                {COLORS.map(c => (
                  <button key={c.value} onClick={() => setColor(c.value)}
                    className={`w-full aspect-square rounded-2xl ${c.bg} transition-all ${color === c.value ? `ring-4 ${c.ring} ring-offset-2 scale-105` : 'opacity-70 hover:opacity-100'}`} />
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('character')}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">← Back</button>
                <button onClick={() => setStep('name')}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors">Choose name →</button>
              </div>
            </div>
          )}

          {step === 'name' && (
            <div className="space-y-4">
              <p className="font-semibold text-oxford text-center">What&apos;s your hero name?</p>
              <input
                autoFocus
                placeholder="e.g. Star Fox, Captain Leo…"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={30}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-center font-semibold text-oxford placeholder:text-gray-300 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
              <div className="flex gap-3">
                <button onClick={() => setStep('color')}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">← Back</button>
                <button onClick={handleSave} disabled={!name.trim() || saving}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm transition-colors">
                  {saving ? 'Saving…' : "Let's go!"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
