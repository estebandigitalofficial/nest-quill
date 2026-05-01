'use client'

import { useRef } from 'react'

interface Props {
  imagePreview: string | null
  onSelect: (base64: string, mimeType: string, preview: string) => void
  onClear: () => void
  disabled?: boolean
  label?: string
  maxSizeMb?: number
}

export default function PhotoUpload({ imagePreview, onSelect, onClear, disabled, label = 'Upload photo', maxSizeMb = 5 }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > maxSizeMb * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      const mimeType = dataUrl.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      onSelect(base64, mimeType, dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  if (imagePreview) {
    return (
      <div className="relative w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imagePreview} alt="Uploaded" className="h-28 w-auto rounded-xl object-cover border border-gray-200" />
        <button
          type="button"
          onClick={onClear}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-700 transition-colors text-sm leading-none"
          aria-label="Remove image"
        >×</button>
      </div>
    )
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
        className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-40 transition-colors"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {label}
      </button>
    </>
  )
}
