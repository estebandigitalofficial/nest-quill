'use client'

import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import type { StoryFormValues } from '@/lib/validators/story-form'
import { STORY_TONES, type StoryTone } from '@/lib/validators/story-form'
import { cn } from '@/lib/utils/cn'

const THEME_PRESETS = [
  { label: 'Space adventure', value: 'A brave astronaut exploring the galaxy' },
  { label: 'Forest magic', value: 'Discovering a magical forest full of talking animals' },
  { label: 'Ocean explorer', value: 'An underwater expedition to find a hidden treasure' },
  { label: 'Dinosaur quest', value: 'A journey back in time to meet friendly dinosaurs' },
  { label: 'Superhero day', value: 'Discovering a special superpower and using it to help others' },
  { label: 'Farm life', value: 'A fun day helping animals on a busy farm' },
  { label: 'Making friends', value: 'Learning how to make a new friend at school' },
  { label: 'Rainy day magic', value: 'Finding out that a rainy day holds wonderful surprises' },
]

const TONE_LABELS: Record<StoryTone, string> = {
  adventurous: 'Adventurous',
  magical: 'Magical',
  funny: 'Funny',
  heartwarming: 'Heartwarming',
  educational: 'Educational',
  brave: 'Brave',
}

export default function StoryStep() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<StoryFormValues>()

  const [showCustom, setShowCustom] = useState(false)
  const selectedTheme = watch('storyTheme') ?? ''
  const selectedTones = watch('storyTone') ?? []

  function selectPreset(value: string) {
    setValue('storyTheme', value, { shouldValidate: true })
    setShowCustom(false)
  }

  function toggleTone(tone: StoryTone) {
    const next = selectedTones.includes(tone)
      ? selectedTones.filter((t) => t !== tone)
      : selectedTones.length < 3
      ? [...selectedTones, tone]
      : selectedTones
    setValue('storyTone', next, { shouldValidate: true })
  }

  const isPresetActive = (value: string) => selectedTheme === value

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif text-gray-900">The story</h2>
        <p className="text-sm text-gray-500 mt-1">
          Pick a theme and mood — we&apos;ll craft the rest around them.
        </p>
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Story theme <span className="text-brand-500">*</span>
        </label>

        <div className="grid grid-cols-2 gap-2">
          {THEME_PRESETS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => selectPreset(value)}
              className={cn(
                'text-left text-sm px-3.5 py-2.5 rounded-xl border-2 transition-all',
                isPresetActive(value)
                  ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              )}
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setShowCustom(true)
              setValue('storyTheme', '', { shouldValidate: false })
            }}
            className={cn(
              'text-left text-sm px-3.5 py-2.5 rounded-xl border-2 transition-all col-span-2',
              showCustom
                ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                : 'border-dashed border-gray-300 bg-white text-gray-400 hover:border-gray-400'
            )}
          >
            + Write my own theme
          </button>
        </div>

        {showCustom && (
          <input
            type="text"
            autoFocus
            placeholder="Describe the story in your own words…"
            {...register('storyTheme')}
            className={inputClass(!!errors.storyTheme)}
          />
        )}

        {!showCustom && selectedTheme && (
          <p className="text-xs text-gray-400 px-1 italic">&ldquo;{selectedTheme}&rdquo;</p>
        )}

        {errors.storyTheme && (
          <p className="text-xs text-red-500">{errors.storyTheme.message}</p>
        )}
      </div>

      {/* Tone */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Story tone <span className="text-brand-500">*</span>
          </label>
          <span className="text-xs text-gray-400">Pick up to 3</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {STORY_TONES.map((tone) => {
            const active = selectedTones.includes(tone)
            const maxed = selectedTones.length >= 3 && !active
            return (
              <button
                key={tone}
                type="button"
                disabled={maxed}
                onClick={() => toggleTone(tone)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all',
                  active
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : maxed
                    ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300'
                )}
              >
                {TONE_LABELS[tone]}
              </button>
            )
          })}
        </div>

        {errors.storyTone && (
          <p className="text-xs text-red-500">{errors.storyTone.message}</p>
        )}
      </div>

      {/* Moral */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          A lesson to weave in{' '}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Sharing makes everyone happier"
          {...register('storyMoral')}
          className={inputClass(!!errors.storyMoral)}
        />
        {errors.storyMoral && (
          <p className="text-xs text-red-500">{errors.storyMoral.message}</p>
        )}
      </div>
    </div>
  )
}

function inputClass(hasError: boolean) {
  return cn(
    'w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 bg-white',
    'placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors',
    hasError ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
  )
}