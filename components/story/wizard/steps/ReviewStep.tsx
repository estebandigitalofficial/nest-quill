'use client'

import { useFormContext } from 'react-hook-form'
import type { StoryFormValues } from '@/lib/validators/story-form'
import { ILLUSTRATION_STYLES } from '@/types/story'
import { PLAN_CONFIG } from '@/lib/plans/config'
import { cn } from '@/lib/utils/cn'
import { useLanguage } from '@/lib/i18n/context'

export default function ReviewStep() {
  const { t } = useLanguage()
  const r = t.wizard.review
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<StoryFormValues>()

  const values = watch()
  const plan = PLAN_CONFIG[values.planTier ?? 'free']
  const styleInfo = values.illustrationStyle
    ? ILLUSTRATION_STYLES[values.illustrationStyle]
    : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif text-gray-900">{r.heading}</h2>
        <p className="text-sm text-gray-500 mt-1">{r.sub}</p>
      </div>

      {/* Summary card */}
      <div className="bg-gray-50 rounded-2xl border border-gray-100 divide-y divide-gray-100 text-sm">
        <Row label={r.labels.plan} value={plan.displayName} />
        <Row label={values.childAge && values.childAge >= 18 ? 'Name' : r.labels.child} value={values.childName ?? '—'} />
        <Row label={r.labels.age} value={values.childAge ? (values.childAge >= 18 ? 'Adult (18+)' : `~${values.childAge} ${t.common.years}`) : '—'} />
        {values.childDescription && (
          <Row label={r.labels.description} value={values.childDescription} />
        )}
        <Row label={r.labels.theme} value={values.storyTheme ? truncate(values.storyTheme, 60) : '—'} />
        <Row
          label={r.labels.tone}
          value={
            values.storyTone?.length
              ? values.storyTone.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')
              : '—'
          }
        />
        {values.storyMoral && <Row label={r.labels.lesson} value={values.storyMoral} />}
        <Row label={r.labels.style} value={styleInfo ? styleInfo.label : '—'} />
        <Row label={r.labels.length} value={values.storyLength ? `${values.storyLength} ${t.common.pages}` : '—'} />
        {values.dedicationText && (
          <Row label={r.labels.dedication} value={truncate(values.dedicationText, 60)} />
        )}
        {values.supportingCharacters && (
          <Row label={r.labels.characters} value={truncate(values.supportingCharacters, 60)} />
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          {r.emailLabel} <span className="text-brand-500">*</span>
        </label>
        <input
          type="email"
          placeholder={r.emailPlaceholder}
          autoComplete="email"
          {...register('userEmail')}
          className={inputClass(!!errors.userEmail)}
        />
        {errors.userEmail && (
          <p className="text-xs text-red-500">{errors.userEmail.message}</p>
        )}
      </div>

      {errors.root && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {errors.root.message}
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className="text-gray-400 w-24 shrink-0">{label}</span>
      <span className="text-gray-700 font-medium flex-1">{value}</span>
    </div>
  )
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + '…' : str
}

function inputClass(hasError: boolean) {
  return cn(
    'w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 bg-white',
    'placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors',
    hasError ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
  )
}
