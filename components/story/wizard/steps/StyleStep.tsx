'use client'

import { useFormContext } from 'react-hook-form'
import type { StoryFormValues } from '@/lib/validators/story-form'
import { ILLUSTRATION_STYLES } from '@/types/story'
import { PLAN_CONFIG } from '@/lib/plans/config'
import { cn } from '@/lib/utils/cn'
import type { IllustrationStyle } from '@/types/story'
import { useLanguage } from '@/lib/i18n/context'

const STYLE_ORDER: IllustrationStyle[] = [
  'watercolor',
  'cartoon',
  'storybook',
  'pencil_sketch',
  'digital_art',
]

const LENGTH_KEYS = ['short', 'standard', 'long', 'epic'] as const
const LENGTH_PAGES = [8, 16, 24, 32] as const

export default function StyleStep() {
  const { t } = useLanguage()
  const s = t.wizard.style
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<StoryFormValues>()

  const selectedStyle = watch('illustrationStyle')
  const selectedLength = watch('storyLength')
  const planTier = watch('planTier')
  const planLimits = PLAN_CONFIG[planTier].limits

  const availableStyleCount = planLimits.illustrationStyleCount
  const maxPages = planLimits.maxPagesPerBook

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif text-gray-900">{s.heading}</h2>
        <p className="text-sm text-gray-500 mt-1">{s.sub}</p>
      </div>

      {/* Illustration style */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {s.styleLabel} <span className="text-brand-500">*</span>
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STYLE_ORDER.map((style, i) => {
            const { label, description } = ILLUSTRATION_STYLES[style]
            const locked = i >= availableStyleCount
            const active = selectedStyle === style

            return (
              <button
                key={style}
                type="button"
                disabled={locked}
                onClick={() =>
                  !locked && setValue('illustrationStyle', style, { shouldValidate: true })
                }
                className={cn(
                  'relative text-left rounded-xl border-2 px-4 py-3 transition-all',
                  active
                    ? 'border-brand-500 bg-brand-50'
                    : locked
                    ? 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                )}
              >
                {locked && (
                  <span className="absolute top-2 right-2 text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {s.locked}
                  </span>
                )}
                <p className={cn('text-sm font-semibold', active ? 'text-brand-700' : 'text-gray-800')}>
                  {label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{description}</p>
              </button>
            )
          })}
        </div>

        {errors.illustrationStyle && (
          <p className="text-xs text-red-500">{errors.illustrationStyle.message}</p>
        )}
      </div>

      {/* Story length */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {s.lengthLabel} <span className="text-brand-500">*</span>
        </label>

        <div className="grid grid-cols-4 gap-2">
          {LENGTH_KEYS.map((key, i) => {
            const pages = LENGTH_PAGES[i]
            const locked = pages > maxPages
            const active = selectedLength === pages
            return (
              <button
                key={pages}
                type="button"
                disabled={locked}
                onClick={() =>
                  !locked && setValue('storyLength', pages, { shouldValidate: true })
                }
                className={cn(
                  'flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all',
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : locked
                    ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                )}
              >
                <span className="font-semibold text-sm">{s.lengths[key]}</span>
                <span className="text-[10px] mt-0.5 opacity-70">{pages} {t.common.pages}</span>
                {locked && (
                  <span className="text-[9px] font-semibold text-gray-400 mt-1 bg-gray-100 px-1.5 rounded-full">
                    {s.locked}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {errors.storyLength && (
          <p className="text-xs text-red-500">{errors.storyLength.message}</p>
        )}
      </div>

      {/* Dedication — conditional on plan */}
      {planLimits.canAddDedication && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Dedication{' '}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="e.g. For Sofia, who makes every day magical. — Mum &amp; Dad"
            {...register('dedicationText')}
            className={cn(inputClass(!!errors.dedicationText), 'resize-none')}
          />
          <p className="text-xs text-gray-400">
            Printed on the first page of the book.
          </p>
          {errors.dedicationText && (
            <p className="text-xs text-red-500">{errors.dedicationText.message}</p>
          )}
        </div>
      )}

      {!planLimits.canAddDedication && (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Dedication page</p>
            <p className="text-xs text-gray-400">Available on Story Pro and above</p>
          </div>
          <span className="text-xs font-semibold text-brand-500 bg-brand-50 px-2.5 py-1 rounded-full">
            Upgrade
          </span>
        </div>
      )}

      {/* Author name */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          Author name{' '}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Mom &amp; Dad, Grandma Joyce"
          {...register('authorName')}
          className={inputClass(!!errors.authorName)}
        />
        <p className="text-xs text-gray-400">Printed on the cover. Leave blank for "A Nest &amp; Quill Original".</p>
        {errors.authorName && (
          <p className="text-xs text-red-500">{errors.authorName.message}</p>
        )}
      </div>

      {/* Closing message */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          Closing page message{' '}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          rows={2}
          placeholder="e.g. You are braver than you know, and loved more than you'll ever understand."
          {...register('closingMessage')}
          className={cn(inputClass(!!errors.closingMessage), 'resize-none')}
        />
        <p className="text-xs text-gray-400">A personal note printed on the final page of the book.</p>
        {errors.closingMessage && (
          <p className="text-xs text-red-500">{errors.closingMessage.message}</p>
        )}
      </div>

      {/* Custom notes */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          Anything else to include?{' '}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          rows={2}
          placeholder="e.g. Her best friend is a stuffed elephant named Peanut"
          {...register('customNotes')}
          className={cn(inputClass(!!errors.customNotes), 'resize-none')}
        />
        {errors.customNotes && (
          <p className="text-xs text-red-500">{errors.customNotes.message}</p>
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