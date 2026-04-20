'use client'

import { useFormContext } from 'react-hook-form'
import type { StoryFormValues } from '@/lib/validators/story-form'
import { PLAN_CONFIG } from '@/lib/plans/config'
import { cn } from '@/lib/utils/cn'
import type { PlanTier } from '@/types/database'

const VISIBLE_PLANS: PlanTier[] = ['free', 'starter', 'pro']

export default function PlanStep() {
  const { watch, setValue } = useFormContext<StoryFormValues>()
  const selected = watch('planTier')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-serif text-gray-900">Choose your plan</h2>
        <p className="text-sm text-gray-500 mt-1">
          Start free — you can always upgrade later.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {VISIBLE_PLANS.map((tier) => {
          const plan = PLAN_CONFIG[tier]
          const isSelected = selected === tier

          return (
            <button
              key={tier}
              type="button"
              onClick={() => setValue('planTier', tier, { shouldValidate: true })}
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
                  <span className="font-semibold text-gray-900 text-sm">
                    {plan.displayName}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center text-white text-[10px]">
                      ✓
                    </span>
                  )}
                </div>

                <p className="text-lg font-bold text-gray-900">
                  {plan.priceMonthly === 0 ? (
                    <span>Free</span>
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
        Payments coming soon — all plans are free during beta.
      </p>
    </div>
  )
}
