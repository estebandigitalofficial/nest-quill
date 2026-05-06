// Single source of truth for the pricing-card visual on both the homepage
// pricing section and the dedicated /pricing page. When betaMode is on:
//   - price displays "Free"
//   - yearly savings line is hidden
//   - CTA uses plan.ctaBeta when defined, otherwise falls through to plan.cta
// When betaMode is off, the configured prices and CTAs render unchanged.
//
// No payment logic. No Stripe call. CTA always links to /create — that route
// gates the actual plan tier separately.

import Link from 'next/link'
import { PLAN_CONFIG } from '@/lib/plans/config'
import type { PlanTier } from '@/types/database'
import { cn } from '@/lib/utils/cn'

interface Props {
  tier: PlanTier
  betaMode: boolean
  /** When true, omit the yearly savings line (used by the homepage to keep cards lean). */
  compact?: boolean
}

export default function PlanCard({ tier, betaMode, compact = false }: Props) {
  const plan = PLAN_CONFIG[tier]

  return (
    <div
      className={cn(
        'relative rounded-2xl border-2 px-5 py-6 flex flex-col',
        plan.isPopular ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white',
      )}
    >
      {plan.isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap">
          Most popular
        </span>
      )}

      <div className="mb-4">
        <p className="font-semibold text-oxford">{plan.displayName}</p>

        <p className="text-2xl font-bold text-oxford mt-1">
          {betaMode || plan.pricingType === 'free' ? (
            'Free'
          ) : plan.pricingType === 'one_time' ? (
            <>
              ${plan.priceMonthly}
              <span className="text-sm font-normal text-charcoal-light"> once</span>
            </>
          ) : (
            <>
              ${plan.priceMonthly}
              <span className="text-sm font-normal text-charcoal-light">/mo</span>
            </>
          )}
        </p>

        {/* Yearly-savings line is hidden during beta to avoid contradicting "Free". */}
        {!betaMode && !compact && plan.pricingType === 'subscription' && plan.priceYearly && (
          <p className="text-xs text-charcoal-light mt-0.5">
            or ${plan.priceYearly}/yr — save{' '}
            {Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)}%
          </p>
        )}
      </div>

      <ul className="space-y-2 flex-1 mb-6">
        {plan.features.map((f) => (
          <li key={f} className="text-xs text-charcoal-light flex gap-2 items-start">
            <span className="text-brand-400 shrink-0 mt-px">✓</span>
            {f}
          </li>
        ))}
      </ul>

      <Link
        // ?plan=<tier> lets the wizard preselect this plan and skip the
        // plan-picker step. The server route still validates planTier
        // before any DB write, so query params are not trusted.
        href={`/create?plan=${tier}`}
        className={cn(
          'block text-center text-sm font-semibold py-2.5 rounded-xl transition-colors',
          plan.isPopular
            ? 'bg-brand-500 hover:bg-brand-600 text-white'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-800',
        )}
      >
        {betaMode && plan.ctaBeta ? plan.ctaBeta : plan.cta}
      </Link>
    </div>
  )
}
