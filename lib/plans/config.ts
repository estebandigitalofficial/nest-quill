import type { PlanConfig, PlanLimits } from '@/types/plans'
import type { PlanTier } from '@/types/database'

/**
 * PLAN CONFIGURATION — single source of truth for every limit in the app.
 *
 * Used by: pricing UI, story wizard, submission API, admin dashboard.
 * To change a limit — edit here only.
 */
export const PLAN_CONFIG: Record<PlanTier, PlanConfig> = {
  free: {
    tier: 'free',
    displayName: 'Free',
    pricingType: 'free',
    priceMonthly: 0,
    cta: 'Get started free',
    limits: {
      booksPerMonth: 1,
      maxPagesPerBook: 8,
      maxIllustrations: 8,
      canAddDedication: false,
      canDownloadPdf: false,
      canOrderPrint: false,
      illustrationStyleCount: 1,
    },
    features: [
      '1 story to try — no card needed',
      'Up to 8 pages',
      '1 illustration style',
      'Read & share online',
      'Email delivery',
    ],
  },

  single: {
    tier: 'single',
    displayName: 'Single Story',
    pricingType: 'one_time',
    priceMonthly: 7.99,
    cta: 'Get started',
    ctaBeta: 'Try free during beta',
    limits: {
      booksPerMonth: 1,
      maxPagesPerBook: 24,
      maxIllustrations: 24,
      canAddDedication: true,
      canDownloadPdf: true,
      canOrderPrint: false,
      illustrationStyleCount: 5,
    },
    features: [
      '1 story, yours to keep',
      'Up to 24 pages',
      'All illustration styles',
      'Full PDF download',
      'Dedication page',
      'No subscription needed',
    ],
  },

  story_pack: {
    tier: 'story_pack',
    displayName: 'Story Pack',
    pricingType: 'subscription',
    priceMonthly: 9.99,
    priceYearly: 99,
    cta: 'Get started',
    ctaBeta: 'Try free during beta',
    limits: {
      booksPerMonth: 3,
      maxPagesPerBook: 24,
      maxIllustrations: 24,
      canAddDedication: true,
      canDownloadPdf: true,
      canOrderPrint: false,
      illustrationStyleCount: 5,
    },
    features: [
      '3 stories/month',
      'Up to 24 pages each',
      'All illustration styles',
      'Full PDF download',
      'Dedication page',
      'Unused stories roll over (up to 2)',
    ],
  },

  story_pro: {
    tier: 'story_pro',
    displayName: 'Story Pro',
    pricingType: 'subscription',
    priceMonthly: 24.99,
    priceYearly: 249,
    cta: 'Get started',
    ctaBeta: 'Try free during beta',
    isPopular: true,
    limits: {
      booksPerMonth: 10,
      maxPagesPerBook: 32,
      maxIllustrations: 32,
      canAddDedication: true,
      canDownloadPdf: true,
      canOrderPrint: true,
      illustrationStyleCount: 5,
    },
    features: [
      '10 stories/month',
      'Up to 32 pages each',
      'All illustration styles',
      'Full PDF download',
      'Dedication page',
      'Priority processing',
      'Print ordering (coming soon)',
    ],
  },

  educator: {
    tier: 'educator',
    displayName: 'Educator',
    pricingType: 'subscription',
    priceMonthly: 59,
    priceYearly: 599,
    cta: 'Start Educator plan',
    limits: {
      booksPerMonth: 40,
      maxPagesPerBook: 32,
      maxIllustrations: 32,
      canAddDedication: true,
      canDownloadPdf: true,
      canOrderPrint: true,
      illustrationStyleCount: 5,
    },
    features: [
      '40 stories/month',
      'Up to 32 pages each',
      'All illustration styles',
      'Classroom & roster management',
      'Class story library',
      'Priority processing',
      'Bulk creation (coming soon)',
    ],
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getPlanLimits(tier: PlanTier): PlanLimits {
  return PLAN_CONFIG[tier].limits
}

export function getActivePlans(): PlanConfig[] {
  return Object.values(PLAN_CONFIG)
}

/** Clamps the requested page count to the plan's maximum. */
export function resolvePageCount(requestedLength: number, tier: PlanTier): number {
  return Math.min(requestedLength, PLAN_CONFIG[tier].limits.maxPagesPerBook)
}

/** Plans shown in the story wizard plan selector (educator handled separately). */
export const WIZARD_PLANS: PlanTier[] = ['free', 'single', 'story_pack', 'story_pro']
