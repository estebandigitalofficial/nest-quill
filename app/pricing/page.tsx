import Link from 'next/link'
import { PLAN_CONFIG, WIZARD_PLANS } from '@/lib/plans/config'
import { cn } from '@/lib/utils/cn'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export const metadata = { title: 'Pricing — Nest & Quill' }

export default function PricingPage() {
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford">← Back</Link>} />

      <div className="flex-1 overflow-y-auto">
      <main className="max-w-5xl mx-auto px-6 py-16 space-y-14 w-full">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-4xl sm:text-5xl text-oxford">Simple, honest pricing</h1>
          <p className="text-charcoal-light max-w-md mx-auto">
            All plans are free during beta. Payments coming soon.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {WIZARD_PLANS.map((tier) => {
            const plan = PLAN_CONFIG[tier]
            return (
              <div
                key={tier}
                className={cn(
                  'relative rounded-2xl border-2 px-5 py-6 flex flex-col',
                  plan.isPopular
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-white'
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
                    {plan.pricingType === 'free' ? (
                      'Free'
                    ) : plan.pricingType === 'one_time' ? (
                      <>${plan.priceMonthly}<span className="text-sm font-normal text-charcoal-light"> once</span></>
                    ) : (
                      <>${plan.priceMonthly}<span className="text-sm font-normal text-charcoal-light">/mo</span></>
                    )}
                  </p>
                  {plan.pricingType === 'subscription' && plan.priceYearly && (
                    <p className="text-xs text-charcoal-light mt-0.5">
                      or ${plan.priceYearly}/yr — save {Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)}%
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
                  href="/create"
                  className={cn(
                    'block text-center text-sm font-semibold py-2.5 rounded-xl transition-colors',
                    plan.isPopular
                      ? 'bg-brand-500 hover:bg-brand-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  )}
                >
                  {plan.cta}
                </Link>
              </div>
            )
          })}
        </div>

        {/* Classroom callout */}
        <div className="bg-oxford rounded-2xl px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-brand-300 uppercase tracking-widest mb-1">For Educators</p>
              <h3 className="font-serif text-xl text-white mb-1">Everything lives in Classroom.</h3>
              <p className="text-sm text-parchment/70 max-w-md">
                One place for your class — free tools today, more coming soon.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-widest mb-1.5">Free now</p>
                {['Classes & join codes', 'Assign quizzes, flashcards & more', 'Track completions & scores'].map(f => (
                  <p key={f} className="text-xs text-parchment/70 flex gap-2 mb-1"><span className="text-brand-400">✓</span>{f}</p>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-widest mb-1.5">Coming soon</p>
                {['Bulk story creation for your class', 'Class story library', 'Progress reports & export'].map(f => (
                  <p key={f} className="text-xs text-parchment/50 flex gap-2 mb-1"><span className="text-parchment/30">○</span>{f}</p>
                ))}
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <Link
              href="/classroom"
              className="inline-block bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors whitespace-nowrap"
            >
              Try Classroom free →
            </Link>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="font-serif text-2xl text-oxford text-center">Common questions</h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div key={item.q} className="border-b border-parchment-dark pb-4">
                <p className="font-medium text-oxford text-sm mb-1">{item.q}</p>
                <p className="text-sm text-charcoal-light leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      </div>
      <SiteFooter />
    </div>
  )
}

const FAQ = [
  {
    q: 'Can I try it before paying?',
    a: 'Yes — the Free plan lets you create one 8-page story at no cost, no credit card required.',
  },
  {
    q: 'What\'s included in the PDF download?',
    a: 'Paid plans include a full-resolution, watermark-free PDF you can keep, print at home, or take to any print shop.',
  },
  {
    q: 'Can I cancel my subscription anytime?',
    a: 'Absolutely. Cancel any time from your account page. You keep access until the end of your billing period.',
  },
  {
    q: 'How long does it take to generate a story?',
    a: 'Usually under two minutes from submission to finished storybook.',
  },
  {
    q: 'Are the stories truly unique?',
    a: 'Yes — every story is generated fresh using your child\'s name, age, interests, and chosen theme. No two stories are the same.',
  },
]
