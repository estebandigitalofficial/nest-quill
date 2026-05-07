'use client'

import { useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import type { StoryFormValues } from '@/lib/validators/story-form'
import {
  CHILD_TONES,
  TEEN_TONES,
  ADULT_TONES,
  ADULT_ONLY_TONES,
  TRAITS,
  SETTINGS,
  CONFLICTS,
  GOALS,
  type AgeTier,
  type Trait,
  type Setting,
  type Conflict,
  type Goal,
} from '@/lib/validators/story-form'
import { cn } from '@/lib/utils/cn'
import { useLanguage } from '@/lib/i18n/context'
import {
  TraitChip,
  SettingCard,
  SETTING_META,
  ConflictCard,
  GoalCard,
} from '../cards'
import { synthesizeTheme } from '@/lib/services/storyFormSynthesis'

const ADULT_ONLY = new Set<string>(ADULT_ONLY_TONES)

function tonesForTier(tier: AgeTier | undefined, learningMode: boolean): readonly string[] {
  if (learningMode) return CHILD_TONES
  if (tier === 'adult') return Array.from(new Set([...CHILD_TONES, ...TEEN_TONES, ...ADULT_TONES]))
  if (tier === 'teen') return Array.from(new Set([...CHILD_TONES, ...TEEN_TONES]))
  return CHILD_TONES
}

function prettifyTone(tone: string): string {
  return tone
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function StoryStep() {
  const { t } = useLanguage()
  const s = t.wizard.story
  const {
    register,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<StoryFormValues>()

  const ageTier = watch('ageTier') as AgeTier | undefined
  const adultConsent = watch('adultConsent')
  const learningMode = !!watch('learningMode')
  const selectedTones = (watch('storyTone') as string[] | undefined) ?? []
  const selectedTraits = (watch('traits') as Trait[] | undefined) ?? []
  const selectedSetting = watch('setting') as Setting | undefined
  const selectedConflict = watch('conflict') as Conflict | undefined
  const selectedGoal = watch('goal') as Goal | undefined
  const customTrait = watch('customTrait') as string | undefined

  // Derive initial state from form values so the custom-theme input stays
  // open when the user navigates away from this step and comes back. A
  // populated storyTheme with no setting selected means the user is in
  // custom mode.
  const [showCustomTheme, setShowCustomTheme] = useState<boolean>(() => {
    const v = getValues()
    return !v.setting && !!v.storyTheme && v.storyTheme.trim().length > 0
  })
  const [showCustomTrait, setShowCustomTrait] = useState<boolean>(!!customTrait)

  const tones = tonesForTier(ageTier, learningMode)
  const adultGated = ageTier === 'adult' && adultConsent === true && !learningMode

  // Keep storyTheme in sync with the synthesized phrase whenever the user
  // hasn't typed a custom one. This preserves the existing >=3-char min on
  // storyTheme without forcing typing.
  useEffect(() => {
    if (showCustomTheme) return
    const synth = synthesizeTheme({
      setting: selectedSetting,
      conflict: selectedConflict,
      goal: selectedGoal,
    })
    if (synth) setValue('storyTheme', synth, { shouldValidate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSetting, selectedConflict, selectedGoal, showCustomTheme])

  function toggleTone(tone: string) {
    if (ADULT_ONLY.has(tone) && !adultGated) return // visually disabled, but defensive
    const next = selectedTones.includes(tone)
      ? selectedTones.filter(t => t !== tone)
      : selectedTones.length < 3
      ? [...selectedTones, tone]
      : selectedTones
    setValue('storyTone', next, { shouldValidate: true })
  }

  function toggleTrait(tr: Trait) {
    const next = selectedTraits.includes(tr)
      ? selectedTraits.filter(t => t !== tr)
      : selectedTraits.length < 3
      ? [...selectedTraits, tr]
      : selectedTraits
    setValue('traits', next, { shouldValidate: true })
  }

  function selectSetting(set: Setting) {
    setValue('setting', set, { shouldValidate: true })
    setShowCustomTheme(false)
  }

  function selectConflict(cf: Conflict) {
    setValue('conflict', selectedConflict === cf ? undefined : cf, { shouldValidate: true })
  }

  function selectGoal(g: Goal) {
    setValue('goal', selectedGoal === g ? undefined : g, { shouldValidate: true })
  }

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-xl font-serif text-gray-900">{s.heading}</h2>
        <p className="text-sm text-gray-500 mt-1">Pick a theme, then add details. Almost no typing.</p>
      </div>

      {/* Theme cards (internal field name stays `setting` for back-compat) */}
      <Section label="Pick a theme" required hint="Choose where the story takes place.">
        <div data-tour-id="theme-cards" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SETTINGS.map(set => (
            <div key={set} data-tour-id={`theme-card-${set}`}>
              <SettingCard
                setting={set}
                active={selectedSetting === set}
                onClick={() => selectSetting(set)}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            // Only blank the theme when leaving an actual selection — re-clicking
            // while already in custom mode must not erase the user's typed text.
            if (!showCustomTheme && selectedSetting) {
              setValue('setting', undefined)
              setValue('storyTheme', '', { shouldValidate: false })
            }
            setShowCustomTheme(true)
          }}
          className={cn(
            'mt-3 text-xs font-semibold transition-colors',
            showCustomTheme ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'
          )}>
          + Or describe a custom theme
        </button>
        {showCustomTheme && (
          <input
            type="text"
            autoFocus
            placeholder={s.themePlaceholder}
            {...register('storyTheme')}
            className={inputClass(!!errors.storyTheme)}
          />
        )}
        {!showCustomTheme && selectedSetting && (
          <p className="text-[11px] text-gray-400 italic">
            {SETTING_META[selectedSetting].description}
          </p>
        )}
        {errors.storyTheme && (
          <p className="text-xs text-red-500">{errors.storyTheme.message}</p>
        )}
      </Section>

      {/* Traits */}
      <Section label="Character traits" hint="Pick up to 3.">
        <div data-tour-id="traits-chips" className="flex flex-wrap gap-2">
          {TRAITS.map(tr => {
            const active = selectedTraits.includes(tr)
            const maxed = selectedTraits.length >= 3 && !active
            return (
              <TraitChip key={tr} trait={tr} active={active} disabled={maxed} onClick={() => toggleTrait(tr)} />
            )
          })}
          {!showCustomTrait && (
            <button
              type="button"
              onClick={() => setShowCustomTrait(true)}
              className="px-3.5 py-1.5 rounded-full text-sm font-medium border border-dashed border-gray-300 text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors">
              + Add your own
            </button>
          )}
        </div>
        {showCustomTrait && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={40}
              autoFocus
              placeholder="e.g. quietly stubborn"
              {...register('customTrait')}
              className={inputClass(!!errors.customTrait)}
            />
            <button
              type="button"
              onClick={() => {
                setValue('customTrait', undefined)
                setShowCustomTrait(false)
              }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2">
              Remove
            </button>
          </div>
        )}
        {errors.customTrait && (
          <p className="text-xs text-red-500">{errors.customTrait.message}</p>
        )}
      </Section>

      {/* Conflict */}
      <Section label="What happens?" hint="The challenge that drives the story.">
        <div data-tour-id="conflict-section" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CONFLICTS.map(cf => (
            <ConflictCard key={cf} conflict={cf} active={selectedConflict === cf} onClick={() => selectConflict(cf)} />
          ))}
        </div>
      </Section>

      {/* Goal */}
      <Section label="What's the goal?" hint="How the journey ends.">
        <div data-tour-id="goal-section" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {GOALS.map(g => (
            <GoalCard key={g} goal={g} active={selectedGoal === g} onClick={() => selectGoal(g)} />
          ))}
        </div>
      </Section>

      {/* Tone */}
      <Section
        label={s.toneLabel}
        required
        hint={s.toneHint}
      >
        <div className="flex flex-wrap gap-2">
          {tones.map(tone => {
            const active = selectedTones.includes(tone)
            const maxed = selectedTones.length >= 3 && !active
            const adultLocked = ADULT_ONLY.has(tone) && !adultGated
            const disabled = maxed || adultLocked
            return (
              <button
                key={tone}
                type="button"
                disabled={disabled}
                onClick={() => toggleTone(tone)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all',
                  active
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : disabled
                    ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300'
                )}
                title={adultLocked ? 'Adult tier required' : undefined}>
                {/* Use i18n label when present, else prettify */}
                {(s.tones as Record<string, string>)[tone] ?? prettifyTone(tone)}
                {ADULT_ONLY.has(tone) && (
                  <span className="ml-1 text-[10px] uppercase opacity-70">18+</span>
                )}
              </button>
            )
          })}
        </div>
        {errors.storyTone && (
          <p className="text-xs text-red-500">{errors.storyTone.message}</p>
        )}
        {!adultGated && ageTier === 'adult' && !learningMode && (
          <p className="text-[11px] text-amber-600">Confirm 18+ consent in the previous step to unlock adult-only tones.</p>
        )}
      </Section>
    </div>
  )
}

function Section({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="block text-sm font-medium text-gray-700">
          {label}{required && <span className="text-brand-500 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function inputClass(hasError: boolean) {
  return cn(
    'w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 bg-white',
    'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors',
    hasError ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
  )
}
