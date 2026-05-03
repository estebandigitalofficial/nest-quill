import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PLAN_CONFIG, WIZARD_PLANS } from '@/lib/plans/config'
import { cn } from '@/lib/utils/cn'
import AnimatedQuill from '@/components/AnimatedQuill'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteHeader from '@/components/layout/SiteHeader'
import { getAdminContext } from '@/lib/admin/guard'
import { getSetting } from '@/lib/settings/appSettings'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const adminCtx = await getAdminContext()
    if (adminCtx) redirect('/admin')
  }

  const betaMode = (await getSetting('beta_mode_enabled', false)) as boolean

  return (
    <div className="min-h-dvh bg-parchment font-sans flex flex-col">
      <SiteHeader
        right={
          <>
            {!user && (
              <Link
                href="/login"
                className="text-sm text-charcoal hover:text-oxford font-medium transition-colors"
              >
                Sign in
              </Link>
            )}

            <Link
              href="/create"
              className="bg-brand-500 hover:bg-brand-600 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-colors whitespace-nowrap"
            >
              <span className="sm:hidden">Create</span>
              <span className="hidden sm:inline">Create a story →</span>
            </Link>
          </>
        }
      />

      <main className="flex-1 overflow-y-auto">
        <Hero betaMode={betaMode} />
        <HowItWorks />
        <SamplePreview />
        <Pricing betaMode={betaMode} />
        <SecondaryProducts />
        <BottomCTA />
      </main>

      <SiteFooter />
    </div>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero({ betaMode }: { betaMode: boolean }) {
  return (
    <section className="bg-brand-50 pt-20 pb-24 px-6 text-center">
      <div className="max-w-4xl mx-auto space-y-7">
        {betaMode && (
          <div className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1 rounded-full tracking-wide uppercase">
            Free during beta
          </div>
        )}

        <div className="flex flex-col lg:flex-row items-center justify-center gap-6">
          <h1 className="font-serif text-5xl sm:text-6xl text-oxford leading-tight text-balance max-w-2xl">
            A storybook made{' '}
            <span className="text-brand-500 italic">just for them.</span>
          </h1>

          <AnimatedQuill size={220} className="hidden lg:block shrink-0" />
        </div>

        <p className="text-lg text-charcoal max-w-xl mx-auto text-balance leading-relaxed">
          Personalized AI-illustrated storybooks starring your child. Pick a theme,
          tell us about them, and we&apos;ll write and illustrate a unique book in
          minutes.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/create"
            className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-7 py-3.5 rounded-full text-base transition-all active:scale-[0.98] shadow-md shadow-brand-200"
          >
            Create your story free →
          </Link>

          <Link
            href="#how-it-works"
            className="bg-white text-oxford font-semibold px-7 py-3.5 rounded-full text-base border border-parchment-dark hover:border-oxford/30 transition-colors"
          >
            See how it works
          </Link>
        </div>

        <p className="text-xs text-gray-400 pt-1">
          No account required · Ready in under 2 minutes
        </p>
      </div>

      <div className="max-w-2xl mx-auto mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SAMPLE_BOOKS.map((book) => (
          <div
            key={book.title}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-5 text-left space-y-2"
          >
            <p className="font-serif text-sm font-semibold text-gray-800 leading-snug">
              {book.title}
            </p>
            <p className="text-xs text-gray-400">{book.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const SAMPLE_BOOKS = [
  { title: "Xavier's Dinosaur Adventure", detail: 'Age 6 · Adventure · Watercolor' },
  { title: 'Sofia Under the Sea', detail: 'Age 4 · Magical · Cartoon' },
  { title: 'Luca Saves the Stars', detail: 'Age 8 · Brave · Digital Art' },
]

// ── How it works ──────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
            A book in three steps
          </h2>
          <p className="text-charcoal-light max-w-md mx-auto">
            From blank page to personalized storybook in under two minutes.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <div key={step.title} className="text-center space-y-3">
              <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-2xl mx-auto font-bold text-brand-500">
                {i + 1}
              </div>

              <div className="text-xs font-bold text-brand-400 uppercase tracking-widest">
                Step {i + 1}
              </div>

              <h3 className="font-serif text-lg text-oxford">{step.title}</h3>

              <p className="text-sm text-charcoal-light leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    title: 'Tell us about your child',
    description:
      'Their name, age, what they love — the more you share, the more personal the story feels.',
  },
  {
    title: 'We write & illustrate',
    description:
      'Our AI writes a unique story and creates illustrations styled exactly how you want.',
  },
  {
    title: 'Read & share',
    description:
      'Your finished storybook is ready to read online and share instantly. Download the full PDF on paid plans.',
  },
]

// ── Sample preview ────────────────────────────────────────────────────────────

function SamplePreview() {
  return (
    <section className="bg-brand-50 py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
            What you get
          </h2>
          <p className="text-charcoal-light max-w-md mx-auto">
            A beautifully structured storybook, page by page.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {PREVIEW_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 flex gap-4 items-start"
            >
              <div>
                <h3 className="font-semibold text-oxford text-sm mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs text-charcoal-light leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const PREVIEW_FEATURES = [
  {
    title: '5 illustration styles',
    description:
      'Choose from watercolor, cartoon, classic storybook, pencil sketch, or digital art.',
  },
  {
    title: 'Up to 32 pages',
    description: 'Short bedtime story or a full adventure — you control the length.',
  },
  {
    title: 'Dedication page',
    description: 'Add a personal message printed on the opening page of the book.',
  },
  {
    title: 'Full PDF download',
    description:
      'Download and keep your story forever. Print at home or at any print shop. Included on all paid plans.',
  },
  {
    title: 'Truly personalized',
    description:
      "The story is written around your child's name, age, personality, and interests.",
  },
  {
    title: 'Ready in minutes',
    description:
      'No waiting days. Your story is generated and ready to read almost instantly.',
  },
]

// ── Pricing ───────────────────────────────────────────────────────────────────

function Pricing({ betaMode }: { betaMode: boolean }) {
  return (
    <section id="pricing" className="py-24 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
            Simple, honest pricing
          </h2>

          {betaMode ? (
            <p className="text-charcoal-light max-w-md mx-auto">
              All story plans are free during beta. Payments coming soon.
            </p>
          ) : (
            <p className="text-charcoal-light max-w-md mx-auto">
              Start free, then upgrade when you want longer books, illustrations,
              and PDF downloads.
            </p>
          )}
        </div>

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
                    {betaMode ? (
                      'Free'
                    ) : plan.pricingType === 'free' ? (
                      'Free'
                    ) : plan.pricingType === 'one_time' ? (
                      <>
                        ${plan.priceMonthly}
                        <span className="text-sm font-normal text-charcoal-light">
                          {' '}
                          once
                        </span>
                      </>
                    ) : (
                      <>
                        ${plan.priceMonthly}
                        <span className="text-sm font-normal text-charcoal-light">
                          /mo
                        </span>
                      </>
                    )}
                  </p>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="text-xs text-charcoal-light flex gap-2 items-start"
                    >
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
                  {betaMode && plan.ctaBeta ? plan.ctaBeta : plan.cta}
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── Secondary products ────────────────────────────────────────────────────────

function SecondaryProducts() {
  return (
    <section className="bg-oxford py-24 px-6 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-900/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-brand-900/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-3">
            More from Nest &amp; Quill
          </p>

          <h2 className="font-serif text-3xl sm:text-4xl text-white mb-3">
            Built for stories, learning, and classrooms.
          </h2>

          <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Personalized storybooks are the first step. Learning tools and classroom
            features are ready when parents, teachers, or schools need more.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-white/8 border border-white/15 rounded-2xl p-7 flex flex-col">
            <div className="mb-5">
              <div className="inline-block bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-4">
                Learning Tools
              </div>

              <h3 className="font-serif text-2xl text-white mb-3">
                Quizzes, flashcards, and study guides for kids.
              </h3>

              <p className="text-sm text-slate-400 leading-relaxed">
                Standalone learning tools for grades 1–8. Great for parents,
                homeschool families, and campaign traffic focused on education.
              </p>
            </div>

            <ul className="space-y-2 mb-7 flex-1">
              {[
                'Quiz generator',
                'Flashcards and study guides',
                'Grades 1–8',
                'Auto-graded practice',
              ].map((item) => (
                <li key={item} className="text-sm text-white/75 flex gap-2">
                  <span className="text-indigo-300">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/learning"
              className="inline-flex justify-center bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-6 py-3 rounded-full text-sm transition-colors"
            >
              Explore Learning Tools →
            </Link>
          </div>

          <div className="bg-white/8 border border-white/15 rounded-2xl p-7 flex flex-col">
            <div className="mb-5">
              <div className="inline-block bg-white/10 border border-white/15 text-white/80 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-4">
                For Educators
              </div>

              <h3 className="font-serif text-2xl text-white mb-3">
                A free teacher dashboard for classrooms.
              </h3>

              <p className="text-sm text-slate-400 leading-relaxed">
                Teachers can create classes, share join codes, assign learning tools,
                and track student progress from one dashboard.
              </p>
            </div>

            <ul className="space-y-2 mb-7 flex-1">
              {[
                'Class join codes',
                'Student progress tracking',
                'Assignment dashboard',
                'Free for teachers',
              ].map((item) => (
                <li key={item} className="text-sm text-white/75 flex gap-2">
                  <span className="text-indigo-300">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/classroom"
              className="inline-flex justify-center bg-white hover:bg-slate-100 text-oxford font-semibold px-6 py-3 rounded-full text-sm transition-colors"
            >
              Try Classroom free →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Bottom CTA ────────────────────────────────────────────────────────────────

function BottomCTA() {
  return (
    <section className="bg-brand-500 py-20 px-6 text-center">
      <div className="max-w-2xl mx-auto space-y-5">
        <h2 className="font-serif text-3xl sm:text-4xl text-white leading-tight">
          Every child deserves a story made for them.
        </h2>

        <p className="text-brand-100 text-base">
          Create your first storybook free — no account required.
        </p>

        <Link
          href="/create"
          className="inline-block bg-white text-brand-600 font-semibold px-8 py-3.5 rounded-full text-base hover:bg-brand-50 transition-colors shadow-lg"
        >
          Create a story now →
        </Link>
      </div>
    </section>
  )
}
