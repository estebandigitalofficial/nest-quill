'use client'

import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import type { StoryFormValues } from '@/lib/validators/story-form'
import { STORY_TONES, type StoryTone } from '@/lib/validators/story-form'
import { cn } from '@/lib/utils/cn'
import { useLanguage } from '@/lib/i18n/context'

const THEME_PRESET_KEYS = ['space', 'forest', 'ocean', 'dinosaur', 'superhero', 'farm', 'friends', 'rainy'] as const
const THEME_VALUES_EN = [
  'A brave astronaut exploring the galaxy',
  'Discovering a magical forest full of talking animals',
  'An underwater expedition to find a hidden treasure',
  'A journey back in time to meet friendly dinosaurs',
  'Discovering a special superpower and using it to help others',
  'A fun day helping animals on a busy farm',
  'Learning how to make a new friend at school',
  'Finding out that a rainy day holds wonderful surprises',
]
const THEME_VALUES_ES = [
  'Un valiente astronauta explorando la galaxia',
  'Descubriendo un bosque mágico lleno de animales que hablan',
  'Una expedición submarina para encontrar un tesoro escondido',
  'Un viaje al pasado para conocer a dinosaurios amistosos',
  'Descubriendo un superpoder especial y usándolo para ayudar a otros',
  'Un día divertido ayudando a los animales en una granja ocupada',
  'Aprendiendo cómo hacer un nuevo amigo en la escuela',
  'Descubriendo que un día lluvioso tiene maravillosas sorpresas',
]

export default function StoryStep() {
  const { lang, t } = useLanguage()
  const s = t.wizard.story
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<StoryFormValues>()

  const [showCustom, setShowCustom] = useState(false)
  const selectedTheme = watch('storyTheme') ?? ''
  const selectedTones = watch('storyTone') ?? []

  const themeValues = lang === 'es' ? THEME_VALUES_ES : THEME_VALUES_EN

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif text-gray-900">{s.heading}</h2>
        <p className="text-sm text-gray-500 mt-1">{s.themeSub}</p>
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {s.themeLabel} <span className="text-brand-500">*</span>
        </label>

        <div className="grid grid-cols-2 gap-2">
          {THEME_PRESET_KEYS.map((key, i) => {
            const value = themeValues[i]
            const active = selectedTheme === value
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectPreset(value)}
                className={cn(
                  'text-left text-sm px-3.5 py-2.5 rounded-xl border-2 transition-all',
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                )}
              >
                {s.themes[key]}
              </button>
            )
          })}

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
            + {s.themeCustom}
          </button>
        </div>

        {showCustom && (
          <input
            type="text"
            autoFocus
            placeholder={s.themePlaceholder}
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
            {s.toneLabel} <span className="text-brand-500">*</span>
          </label>
          <span className="text-xs text-gray-400">{s.toneHint}</span>
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
                {s.tones[tone as keyof typeof s.tones]}
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
          {s.moralLabel}
        </label>
        <input
          type="text"
          placeholder={s.moralPlaceholder}
          {...register('storyMoral')}
          className={inputClass(!!errors.storyMoral)}
        />
        {s.moralHint && <p className="text-xs text-gray-400">{s.moralHint}</p>}
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
