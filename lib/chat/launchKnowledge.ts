// Commercial knowledge for the public chat widget's system prompt.
//
// Pure module (no Next/OpenAI imports) so the policy test in
// lib/launch/claims.test.ts can render it. Every number is interpolated from
// lib/entitlements/policy.ts (TIER_CAPS, Free allowances) and
// lib/plans/config.ts (prices), so the assistant cannot drift from the plan
// cards: launch model = monthly billing only, Pack 3 / Pro 6 books per
// period, pages 8/16/24/32, no annual price, no print ordering, no deferred
// products.
import { PLAN_CONFIG } from '../plans/config.ts'
import { FREE_GUEST_BOOKS, FREE_LIFETIME_BOOKS, TIER_CAPS } from '../entitlements/policy.ts'

export function launchPricingKnowledge(): string {
  const p = PLAN_CONFIG
  return [
    `- Free: $0 — up to ${TIER_CAPS.free.maxPages} pages, Watercolor style, read & share online, email delivery. No credit card. A guest can create ${FREE_GUEST_BOOKS} Free book without an account; an account allows ${FREE_LIFETIME_BOOKS} Free books in total, and a guest book later claimed into the account counts toward that ${FREE_LIFETIME_BOOKS} (it is never ${FREE_GUEST_BOOKS + FREE_LIFETIME_BOOKS}).`,
    `- Single Story: $${p.single.priceMonthly} one-time — 1 story, up to ${TIER_CAPS.single.maxPages} pages, all illustration styles, full PDF download, dedication page, no subscription.`,
    `- Story Pack: $${p.story_pack.priceMonthly}/month — ${TIER_CAPS.story_pack.periodAllowance} books per monthly billing period, up to ${TIER_CAPS.story_pack.maxPages} pages each, all styles, full PDF, dedication page.`,
    `- Story Pro (most popular): $${p.story_pro.priceMonthly}/month — ${TIER_CAPS.story_pro.periodAllowance} books per monthly billing period, up to ${TIER_CAPS.story_pro.maxPages} pages each, all styles, full PDF, dedication page.`,
    '- Subscriptions bill monthly only. There is no annual or yearly plan. Unused books in a billing period do not roll over.',
    '- Nest & Quill does not offer print ordering or priority processing. Paid plans include a print-ready PDF the family can print at home or at any print shop.',
    '- Payments are handled on /pricing. If someone cannot complete a purchase yet, say paid checkout is being finalized and that the Free book is available right now.',
  ].join('\n')
}

