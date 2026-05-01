'use client'

import { useState, type ReactNode } from 'react'
import { useFormContext } from 'react-hook-form'
import type { StoryFormValues } from '@/lib/validators/story-form'
import { cn } from '@/lib/utils/cn'
import { useLanguage } from '@/lib/i18n/context'

const AGE_GROUPS = [
  { label: '1–3', key: 'toddler' as const, age: 2 },
  { label: '4–6', key: 'preK' as const, age: 5 },
  { label: '7–9', key: 'earlyReader' as const, age: 8 },
  { label: '10–12', key: 'middleGrade' as const, age: 11 },
  { label: '18+', key: 'adult' as const, age: 18 },
]

export default function ChildStep() {
  const { t } = useLanguage()
  const c = t.wizard.child
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<StoryFormValues>()

  const selectedAge = watch('childAge')
  const adultConsent = watch('adultConsent')
  const isAdult = selectedAge === 18

  const [showConsentModal, setShowConsentModal] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)

  function handleAgeSelect(age: number) {
    if (age === 18) {
      if (!adultConsent) {
        setConsentChecked(false)
        setShowConsentModal(true)
      }
      setValue('childAge', age, { shouldValidate: true })
    } else {
      // Reset adult consent when switching away from adult
      if (adultConsent) {
        setValue('adultConsent', undefined)
      }
      setValue('childAge', age, { shouldValidate: true })
    }
  }

  function handleConsentConfirm() {
    setValue('adultConsent', true)
    setShowConsentModal(false)
  }

  function handleConsentCancel() {
    setValue('childAge', undefined as unknown as number)
    setValue('adultConsent', undefined)
    setShowConsentModal(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif text-gray-900">
          {isAdult ? c.adultHeading : c.heading}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {isAdult ? c.adultSub : c.sub}
        </p>
      </div>

      <Field label={isAdult ? c.adultName : c.name} error={errors.childName?.message} required>
        <input
          type="text"
          placeholder={isAdult ? c.adultNamePlaceholder : c.namePlaceholder}
          autoComplete="off"
          {...register('childName')}
          className={inputClass(!!errors.childName)}
        />
      </Field>

      <Field label={c.ageGroup} error={errors.childAge?.message} required>
        <div className="grid grid-cols-5 gap-2">
          {AGE_GROUPS.map(({ label, key, age }) => {
            const active = selectedAge === age
            return (
              <button
                key={age}
                type="button"
                onClick={() => handleAgeSelect(age)}
                className={cn(
                  'flex flex-col items-center py-3 px-2 rounded-xl border-2 text-center transition-all',
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                )}
              >
                <span className="font-semibold text-sm">{label}</span>
                <span className="text-[10px] text-gray-400 mt-0.5">{c.ages[key]}</span>
              </button>
            )
          })}
        </div>
      </Field>

      <Field
        label={isAdult ? c.adultAbout : c.about}
        error={errors.childDescription?.message}
        hint={isAdult ? c.adultAboutHint : c.aboutHint}
      >
        <textarea
          rows={3}
          placeholder={isAdult ? c.adultAboutPlaceholder : c.aboutPlaceholder}
          {...register('childDescription')}
          className={cn(inputClass(!!errors.childDescription), 'resize-none')}
        />
      </Field>

      <Field
        label="Supporting characters"
        error={errors.supportingCharacters?.message}
        hint="Siblings, friends, pets, or anyone else to weave into the story."
      >
        <textarea
          rows={2}
          placeholder="e.g. Her little brother Max, and Luna the tabby cat"
          {...register('supportingCharacters')}
          className={cn(inputClass(!!errors.supportingCharacters), 'resize-none')}
        />
      </Field>

      {/* Adult consent modal */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-8 py-6 max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">{c.consentTitle}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{c.consentBody}</p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
              />
              <span className="text-sm text-gray-700">{c.consentAgree}</span>
            </label>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={handleConsentCancel}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                {c.consentCancel}
              </button>
              <button
                type="button"
                onClick={handleConsentConfirm}
                disabled={!consentChecked}
                className="text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
              >
                {c.consentContinue}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label, error, hint, required, children,
}: {
  label: string; error?: string; hint?: string; required?: boolean; children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-brand-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
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
