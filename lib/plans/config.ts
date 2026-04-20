import type { PlanConfig, PlanLimits } from '@/types/plans'
import type { PlanTier } from '@/types/database'

/**
 * PLAN CONFIGURATION
 *
 * This is the single source of truth for every limit in the app.
 * To change a limit — edit it here. Nothing else needs to change.
 *
 * These values are used by:
 * - The pricing page (marketing)
 * - The story form (showing/hiding fields)
 * - The submission API (enforcing limits server-side)
 * - The admin dashboard
 */
export const PLAN_CONFIG: Record<PlanTier, PlanConfig> = {
  free: {
    tier: 'free',
    displayName: 'Free',
    priceMonthly: 0,
    cta: 'Start for free',
    limits: {
      booksPerMonth: 1,
      maxPagesPerBook: 16,
      maxIllustrations: 8,
      canAddDedication: false,
      canDownloadPdf: true,
      canOrderPrint: false,
      illustrationStyleCount: 1,
    },
    features: [
      '1 personalized storybook/month',
      'Up to 16 pages',
      '8 AI illustrations',
      'PDF download',
      'Watercolor style only',
    ],
  },

  starter: {
    tier: 'starter',
    displayName: 'Starter',
    priceMonthly: 14.99,
    cta: 'Get started',
    limits: {
      booksPerMonth: 3,
      maxPagesPerBook: 24,
      maxIllustrations: 12,
      canAddDedication: false,
      canDownloadPdf: true,
      canOrderPrint: false,
      illustrationStyleCount: 3,
    },
    features: [
      '3 storybooks/month',
      'Up to 24 pages',
      '12 AI illustrations',
      'PDF download & email delivery',
      '3 illustration styles',
    ],
  },

  pro: {
    tier: 'pro',
    displayName: 'Story Pro',
    priceMonthly: 29.99,
    cta: 'Go Pro',
    isPopular: true,
    limits: {
      booksPerMonth: 10,
      maxPagesPerBook: 32,
      maxIllustrations: 16,
      canAddDedication: true,
      canDownloadPdf: true,
      canOrderPrint: true,
      illustrationStyleCount: 5,
    },
    features: [
      '10 storybooks/month',
      'Up to 32 pages',
      '16 AI illustrations',
      'Personal dedication page',
      'All 5 illustration styles',
      'PDF download, email & print ordering',
    ],
  },

  enterprise: {
    tier: 'enterprise',
    displayName: 'Educator / Commercial',
    priceMonthly: 0,   // custom — contact us
    cta: 'Contact us',
    limits: {
      booksPerMonth: 999,
      maxPagesPerBook: 48,
      maxIllustrations: 24,
      canAddDedication: true,
      canDownloadPdf: true,
      canOrderPrint: true,
      illustrationStyleCount: 5,
    },
    features: [
      'Unlimited storybooks',
      'Up to 48 pages',
      'Custom illustration style',
      'White-label option',
      'Bulk classroom use',
      'Dedicated support',
    ],
  },
}

// ─── Helper: get limits for a tier ───────────────────────────────────────────
export function getPlanLimits(tier: PlanTier): PlanLimits {
  return PLAN_CONFIG[tier].limits
}

// ─── Helper: get all active plans for pricing page ───────────────────────────
export function getActivePlans(): PlanConfig[] {
  return Object.values(PLAN_CONFIG)
}

// ─── Helper: resolve the correct page count for a request ────────────────────
// Clamps the user's requested length to the plan's max
export function resolvePageCount(
  requestedLength: number,
  tier: PlanTier
): number {
  const max = PLAN_CONFIG[tier].limits.maxPagesPerBook
  return Math.min(requestedLength, max)
}
