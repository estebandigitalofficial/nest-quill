'use client'

import { useFormContext } from 'react-hook-form'
import type { StoryFormValues } from '@/lib/validators/story-form'
import { ILLUSTRATION_STYLES } from '@/types/story'
import { PLAN_CONFIG } from '@/lib/plans/config'
import { cn } from '@/lib/utils/cn'
import { useLanguage } from '@/lib/i18n/context'
import {
  AGE_TIER_META,
  TRAIT_LABELS,
  SETTING_META,
  CONFLICT_META,
  GOAL_META,
} from '../cards'
import type { AgeTier, Trait, Setting, Conflict, Goal } from '@/lib/validators/story-form'

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
  const themeMeta = values.setting ? SETTING_META[values.setting as Setting] : null
  const traitChips: string[] = [
    ...((values.traits ?? []).map(tr => TRAIT_LABELS[tr as Trait] ?? tr)),
    ...(values.customTrait ? [values.customTrait] : []),
  ]
  const toneChips = values.storyTone?.map(prettifyTone) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif text-gray-900">Here's the story you built</h2>
        <p className="text-sm text-gray-500 mt-1">{r.sub}</p>
      </div>

      {/* Hero theme card — visual at-a-glance preview */}
      {themeMeta && (
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 aspect-[5/2] sm:aspect-[5/1.6]">
          <div className={cn('absolute inset-0 bg-gradient-to-br', themeMeta.gradient)} />
          {themeMeta.art}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
          <div className="relative h-full flex flex-col justify-end p-4">
            <p className="text-xs uppercase tracking-wider text-white/80">Theme</p>
            <p className="text-white font-serif text-lg drop-shadow">{themeMeta.label}</p>
            {values.storyTheme && (
              <p className="text-white/90 text-xs mt-0.5 line-clamp-2 drop-shadow">{values.storyTheme}</p>
            )}
          </div>
        </div>
      )}

      {/* Chip grid: traits / conflict / goal / tone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {traitChips.length > 0 && (
          <ChipGroup label="Character traits" items={traitChips} />
        )}
        {values.conflict && (
          <ChipGroup label="Conflict" items={[CONFLICT_META[values.conflict as Conflict].label]} highlight />
        )}
        {values.goal && (
          <ChipGroup label="Goal" items={[GOAL_META[values.goal as Goal].label]} highlight />
        )}
        {toneChips.length > 0 && (
          <ChipGroup label={r.labels.tone} items={toneChips} />
        )}
      </div>

      {/* Compact details card */}
      <div className="bg-gray-50 rounded-2xl border border-gray-100 divide-y divide-gray-100 text-sm">
        <Row label={r.labels.plan} value={plan.displayName} />
        <Row label="Audience" value={values.ageTier ? AGE_TIER_META[values.ageTier as AgeTier].label : (values.childAge && values.childAge >= 18 ? 'Adult (18+)' : 'Child')} />
        <Row label={values.childAge && values.childAge >= 18 ? 'Name' : r.labels.child} value={values.childName ?? '—'} />
        <Row label={r.labels.age} value={values.childAge ? (values.childAge >= 18 ? 'Adult (18+)' : `~${values.childAge} ${t.common.years}`) : '—'} />
        {values.childDescription && (
          <Row label={r.labels.description} value={values.childDescription} />
        )}
        {values.storyMoral && <Row label={r.labels.lesson} value={values.storyMoral} />}
        <Row label={r.labels.style} value={styleInfo ? styleInfo.label : '—'} />
        <Row label={r.labels.length} value={values.storyLength ? `${values.storyLength} ${t.common.pages}` : '—'} />
        {values.dedicationText && (
          <Row label={r.labels.dedication} value={truncate(values.dedicationText, 80)} />
        )}
        {values.supportingCharacters && (
          <Row label={r.labels.characters} value={truncate(values.supportingCharacters, 80)} />
        )}
        {values.customNotes && (
          <Row label="Custom note" value={truncate(values.customNotes, 100)} />
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

function ChipGroup({ label, items, highlight }: { label: string; items: string[]; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium',
              highlight
                ? 'bg-brand-50 text-brand-700 border border-brand-100'
                : 'bg-gray-100 text-gray-700'
            )}>
            {item}
          </span>
        ))}
      </div>
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

function prettifyTone(tone: string) {
  return tone.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function inputClass(hasError: boolean) {
  return cn(
    'w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 bg-white',
    'placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors',
    hasError ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
  )
}
