'use client'

import { useFormContext } from 'react-hook-form'
import type { StoryFormValues } from '@/lib/validators/story-form'
import { PLAN_CONFIG, WIZARD_PLANS } from '@/lib/plans/config'
import { cn } from '@/lib/utils/cn'
import { useWizardConfig } from '../WizardContext'

export default function PlanStep() {
  const { watch, setValue } = useFormContext<StoryFormValues>()
  const { betaMode } = useWizardConfig()
  const selected = watch('planTier')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-serif text-gray-900">Choose your plan</h2>
        <p className="text-sm text-gray-500 mt-1">
          {betaMode
            ? 'Start free — payments are coming soon, all plans are free during beta.'
            : 'Select a plan to get started.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {WIZARD_PLANS.map((tier) => {
          const plan = PLAN_CONFIG[tier]
          const isSelected = selected === tier

          return (
            <button
              key={tier}
              type="button"
              onClick={() => {
                setValue('planTier', tier, { shouldValidate: true })
                // Reset story length to the plan's max so it's never pre-set above the limit
                const maxPages = PLAN_CONFIG[tier].limits.maxPagesPerBook
                setValue('storyLength', Math.min(maxPages, 16) as 8 | 16 | 24 | 32, { shouldValidate: false })
              }}
              className={cn(
                'relative text-left rounded-2xl border-2 px-4 py-4 transition-all',
                isSelected
                  ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              {plan.isPopular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap">
                  Most popular
                </span>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900 text-sm">{plan.displayName}</span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center text-white text-[10px]">
                      ✓
                    </span>
                  )}
                </div>

                <p className="text-lg font-bold text-gray-900">
                  {plan.pricingType === 'free' ? (
                    'Free'
                  ) : plan.pricingType === 'one_time' ? (
                    <>
                      ${plan.priceMonthly}
                      <span className="text-xs font-normal text-gray-400"> one-time</span>
                    </>
                  ) : (
                    <>
                      ${plan.priceMonthly}
                      <span className="text-xs font-normal text-gray-400">/mo</span>
                    </>
                  )}
                </p>

                <ul className="space-y-1 mt-1">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="text-xs text-gray-500 flex gap-1.5 items-start">
                      <span className="text-brand-400 mt-px shrink-0">·</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Are you a teacher?{' '}
        <span className="text-brand-500 font-medium">Educator plans coming soon.</span>
      </p>
    </div>
  )
}
