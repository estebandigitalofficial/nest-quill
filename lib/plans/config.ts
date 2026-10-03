import type { PlanConfig, PlanLimits } from '@/types/plans'
import type { PlanTier } from '@/types/database'
import { TIER_CAPS, type LaunchTier } from '@/lib/entitlements/policy'

/**
 * PLAN CONFIGURATION — display catalogue for pricing UI, wizard and admin.
 *
 * Enforcement does NOT read this file. Capabilities (pages, styles,
 * dedication, PDF, period allowance) come from lib/entitlements/policy.ts;
 * the four launch tiers below mirror those caps so copy cannot drift.
 */
export const PLAN_CONFIG: Record<PlanTier, PlanConfig> = {
  free: {
    tier: 'free',
    displayName: 'Free',
    pricingType: 'free',
    priceMonthly: 0,
    cta: 'Get started free',
    limits: {
      booksPerMonth: 2,
      maxPagesPerBook: TIER_CAPS.free.maxPages,
      maxIllustrations: TIER_CAPS.free.maxPages,
      canAddDedication: TIER_CAPS.free.dedication,
      canDownloadPdf: TIER_CAPS.free.pdf,
      canOrderPrint: false,
      illustrationStyleCount: TIER_CAPS.free.styles.length,
    },
    features: [
      '2 stories to try — no card needed',
      'Up to 8 pages',
      'Watercolor illustration style',
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
      maxPagesPerBook: TIER_CAPS.single.maxPages,
      maxIllustrations: TIER_CAPS.single.maxPages,
      canAddDedication: TIER_CAPS.single.dedication,
      canDownloadPdf: TIER_CAPS.single.pdf,
      canOrderPrint: false,
      illustrationStyleCount: TIER_CAPS.single.styles.length,
    },
    features: [
      '1 story, yours to keep',
      'Up to 16 pages',
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
      booksPerMonth: TIER_CAPS.story_pack.periodAllowance ?? 3,
      maxPagesPerBook: TIER_CAPS.story_pack.maxPages,
      maxIllustrations: TIER_CAPS.story_pack.maxPages,
      canAddDedication: TIER_CAPS.story_pack.dedication,
      canDownloadPdf: TIER_CAPS.story_pack.pdf,
      canOrderPrint: false,
      illustrationStyleCount: TIER_CAPS.story_pack.styles.length,
    },
    features: [
      '3 stories/month',
      'Up to 24 pages each',
      'All illustration styles',
      'Full PDF download',
      'Dedication page',
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
      booksPerMonth: TIER_CAPS.story_pro.periodAllowance ?? 6,
      maxPagesPerBook: TIER_CAPS.story_pro.maxPages,
      maxIllustrations: TIER_CAPS.story_pro.maxPages,
      canAddDedication: TIER_CAPS.story_pro.dedication,
      canDownloadPdf: TIER_CAPS.story_pro.pdf,
      canOrderPrint: true,
      illustrationStyleCount: TIER_CAPS.story_pro.styles.length,
    },
    features: [
      '6 stories/month',
      'Up to 32 pages each',
      'All illustration styles',
      'Full PDF download',
      'Dedication page',
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
export const WIZARD_PLANS: LaunchTier[] = ['free', 'single', 'story_pack', 'story_pro']
