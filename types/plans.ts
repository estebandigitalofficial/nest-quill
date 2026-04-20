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
  priceMonthly: number  // in dollars, 0 = free
  priceYearly?: number
  limits: PlanLimits
  features: string[]    // marketing bullet points shown on pricing page
  isPopular?: boolean
  cta: string
}
