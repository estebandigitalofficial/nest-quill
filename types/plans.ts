import type { PlanTier } from './database'

// ─── Plan limits config ───────────────────────────────────────────────────────
// This mirrors what's in lib/plans/config.ts but as pure types.
// Keep these in sync.

export interface PlanLimits {
  booksPerMonth: number
  maxPagesPerBook: number
  maxIllustrations: number
  canAddDedication: boolean
  canDownloadPdf: boolean
  canOrderPrint: boolean
  illustrationStyleCount: number  // how many style options are available
}

export interface PlanConfig {
  tier: PlanTier
  displayName: string
  pricingType: 'free' | 'one_time' | 'subscription'
  priceMonthly: number  // dollars; for one_time = single purchase price
  priceYearly?: number
  limits: PlanLimits
  features: string[]
  isPopular?: boolean
  cta: string
  ctaBeta?: string
}
