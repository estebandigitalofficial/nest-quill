# Nest & Quill — Pricing Model

## Core Strategy

Three distinct buying behaviors require three different pricing shapes:

- **Casual / gift buyer** — wants to pay once, not subscribe
- **Regular parent / creator** — will subscribe if the value is clear
- **Educator** — institutional buyer, needs to justify cost to a school

## Tiers

### Free — $0 (trial, not ongoing)
- 1 story, one time — not a monthly reset
- 8 pages, watermarked PDF
- Watercolor style only
- No account required (guest)
- **Purpose:** prove the product, then force a decision

### Single Story — $7.99 (one-time, no subscription)
- 1 story, yours to keep
- Up to 24 pages
- All 5 illustration styles
- Full PDF download, no watermark
- Dedication page
- No account required
- **Target:** grandparents, gift-givers, one-off use — people who will never subscribe

### Story Pack — $9.99/month ($99/year)
- 3 stories/month
- Up to 24 pages each
- All illustration styles
- Full PDF download
- Dedication page
- Unused stories roll over (up to 2)
- **Target:** active parents making books regularly

### Story Pro — $24.99/month ($249/year)
- 10 stories/month
- Up to 32 pages each
- All illustration styles
- Full PDF download
- Dedication page
- Priority processing
- Print ordering credit (coming soon)
- **Target:** power users, families with multiple children, creators

### Educator — $59/month ($599/year)
- 40 stories/month
- Up to 32 pages each
- All illustration styles
- Classroom & roster management
- Class story library
- Priority processing
- Bulk creation (Phase 2)
- **Target:** classroom teachers, reading specialists, school librarians
- **Note:** $59/month sits under the ~$75 threshold most US teachers can expense without approval

### School / District — Custom (Phase 2)
- Multi-class dashboards
- Org billing / multi-seat
- Reporting
- SSO (later)

## Add-ons (Phase 2)
- Extra story top-up: $5.99 each (any plan)
- Printed book: $24.99 + shipping
- Annual billing: ~17% discount on all subscription tiers

## Why This Structure

**Single Story is critical.** The gift market (grandparents, aunts, birthdays) will never subscribe. Without a one-time option you lose that entire segment. At $7.99 it's an impulse purchase.

**Free is a one-time trial, not a monthly reset.** Monthly free resets kill conversion pressure. One story ever forces a decision.

**No Family tier.** Family tiers typically underperform. Story Pro at $24.99 covers families well without adding a dead tier.

**Educator at $59 not $49.** Feels more confident, and lands under most school expense thresholds without approval.

**Story Pack under $10.** Competing with Netflix/Spotify in the parent's mental budget. Under $10 is a psychologically different category.

## Schema Mapping

| Tier | DB enum value |
|---|---|
| Free | `free` |
| Single Story | `single` |
| Story Pack | `story_pack` |
| Story Pro | `story_pro` |
| Educator | `educator` |

Single Story requires a `purchases` table (one-time Stripe payment intent, no subscription).
Story Pack and Story Pro use Stripe subscriptions.
Educator uses a Stripe subscription with optional future per-seat billing.

## MVP Launch Order

1. Free (already works — guest flow)
2. Single Story (one-time Stripe Checkout)
3. Story Pack (Stripe subscription)
4. Story Pro (Stripe subscription)
5. Educator (after auth + classroom features ship)
