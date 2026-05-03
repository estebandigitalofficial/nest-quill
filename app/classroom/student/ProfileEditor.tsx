'use client'

import { useRef, useState } from 'react'

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

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export interface ProfileFields {
  display_name: string
  avatar_color: string
  avatar_url: string | null
}

interface Props {
  initial: ProfileFields
  onSaved: (profile: ProfileFields) => void
  onCancel: () => void
}

export default function ProfileEditor({ initial, onSaved, onCancel }: Props) {
  const [name, setName] = useState(initial.display_name)
  const [color, setColor] = useState(initial.avatar_color)
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial.avatar_url)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedColor = COLORS.find(c => c.value === color) ?? COLORS[0]
  const previewSrc = photoPreview ?? photoUrl

  function handleFile(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Use a PNG, JPG, or WebP image.'); return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be 2 MB or smaller.'); return
    }
    setError(null)
    setPendingFile(file)
    const reader = new FileReader()
    reader.onload = e => setPhotoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function removePhoto() {
    setError(null)
    setSaving(true)
    const res = await fetch('/api/classroom/student/avatar', { method: 'DELETE' })
    setSaving(false)
    if (!res.ok) { setError('Could not remove photo.'); return }
    setPhotoUrl(null); setPhotoPreview(null); setPendingFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSave() {
    setError(null)
    if (!name.trim()) { setError('Display name is required.'); return }
    setSaving(true)

    let nextAvatarUrl = photoUrl
    if (pendingFile) {
      const form = new FormData()
      form.append('file', pendingFile)
      const upload = await fetch('/api/classroom/student/avatar', { method: 'POST', body: form })
      const data = await upload.json()
      if (!upload.ok) { setError(data.message ?? 'Upload failed.'); setSaving(false); return }
      nextAvatarUrl = data.profile.avatar_url
    }

    const res = await fetch('/api/classroom/student/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: name.trim(), avatar_color: color }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.message ?? 'Save failed.'); return }

    onSaved({
      display_name: data.profile.display_name,
      avatar_color: data.profile.avatar_color,
      avatar_url: nextAvatarUrl,
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-6">
      <div>
        <p className="font-semibold text-oxford">Edit your profile</p>
        <p className="text-xs text-charcoal-light mt-0.5">Optional — your dashboard works without this.</p>
      </div>

      {/* Avatar preview + photo controls */}
      <div className="flex items-center gap-5">
        <div className={`relative w-20 h-20 rounded-2xl overflow-hidden ${previewSrc ? 'bg-gray-100' : selectedColor.bg} flex items-center justify-center text-white font-bold text-2xl shadow-sm`}>
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span>{getInitials(name)}</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={saving}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 border border-indigo-200 hover:border-indigo-300 rounded-xl px-3.5 py-2 transition-colors disabled:opacity-50">
            {previewSrc ? 'Change photo' : 'Upload photo'}
          </button>
          {(photoUrl || photoPreview) && (
            <button
              type="button"
              onClick={() => { setPhotoPreview(null); setPendingFile(null); if (fileRef.current) fileRef.current.value = ''; if (photoUrl) removePhoto() }}
              disabled={saving}
              className="block text-xs text-gray-500 hover:text-red-500 font-semibold transition-colors">
              Remove photo
            </button>
          )}
          <p className="text-[11px] text-gray-400">PNG, JPG, or WebP up to 2 MB.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>

      {/* Display name */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-600">Display name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={30}
          placeholder="Your name"
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
        />
      </div>

      {/* Color (used as fallback when no photo) */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-600">
          Avatar color <span className="text-gray-400 font-normal">— used when you don&apos;t have a photo</span>
        </label>
        <div className="grid grid-cols-8 gap-2">
          {COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              aria-label={c.value}
              className={`w-full aspect-square rounded-xl ${c.bg} transition-all ${color === c.value ? `ring-4 ${c.ring} ring-offset-2 scale-105` : 'opacity-70 hover:opacity-100'}`}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
