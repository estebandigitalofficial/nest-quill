import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PLAN_CONFIG, WIZARD_PLANS } from '@/lib/plans/config'
import { cn } from '@/lib/utils/cn'
import LogoutButton from '@/components/auth/LogoutButton'
import SiteFooter from '@/components/layout/SiteFooter'
import SiteHeader from '@/components/layout/SiteHeader'
import { getAdminContext } from '@/lib/admin/guard'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const adminCtx = await getAdminContext()
    if (adminCtx) redirect('/admin')
  }

  return (
    <div className="h-dvh bg-parchment font-sans flex flex-col">
      <SiteHeader right={
        <>
          {user ? (
            <>
              <Link href="/account"
                className="text-sm text-charcoal hover:text-oxford font-medium transition-colors hidden sm:block">
                My stories
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login"
              className="text-sm text-charcoal hover:text-oxford font-medium transition-colors">
              Sign in
            </Link>
          )}
          <Link href="/create"
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors">
            Create a story →
          </Link>
        </>
      } />
      <div className="flex-1 overflow-y-auto">
        <Hero />
        <LearningStoriesSection />
        <HowItWorks />
        <SamplePreview />
        <EducatorBanner />
        <Pricing />
        <BottomCTA />
      </div>
      <SiteFooter />
    </div>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="bg-brand-50 pt-20 pb-24 px-6 text-center">
      <div className="max-w-3xl mx-auto space-y-7">
        <div className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1 rounded-full tracking-wide uppercase">
          Free during beta
        </div>

        <h1 className="font-serif text-5xl sm:text-6xl text-oxford leading-tight text-balance">
          A storybook made{' '}
          <span className="text-brand-500 italic">just for them.</span>
        </h1>

        <p className="text-lg text-charcoal max-w-xl mx-auto text-balance leading-relaxed">
          Personalized AI-illustrated storybooks starring your child. Pick a theme, tell us about them, and we&apos;ll write and illustrate a unique book in minutes.
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

      {/* Decorative book cards */}
      <div className="max-w-2xl mx-auto mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SAMPLE_BOOKS.map((book) => (
          <div
            key={book.title}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-5 text-left space-y-2"
          >
            <div className="text-2xl">{book.emoji}</div>
            <p className="font-serif text-sm font-semibold text-gray-800 leading-snug">{book.title}</p>
            <p className="text-xs text-gray-400">{book.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const SAMPLE_BOOKS = [
  { emoji: '🦕', title: "Xavior's Dinosaur Adventure", detail: 'Age 6 · Adventure · Watercolor' },
  { emoji: '🌊', title: "Sofia Under the Sea", detail: 'Age 4 · Magical · Cartoon' },
  { emoji: '🚀', title: "Luca Saves the Stars", detail: 'Age 8 · Brave · Digital Art' },
]

// ── Learning teaser ───────────────────────────────────────────────────────────

function LearningStoriesSection() {
  return (
    <section className="bg-oxford py-20 px-6 overflow-hidden relative">
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-900/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-brand-900/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto relative text-center space-y-6">
        <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
          For Kids · Grades 1–8
        </div>

        <h2 className="font-serif text-4xl sm:text-5xl text-white leading-tight text-balance">
          Learning that actually{' '}
          <span className="text-indigo-300 italic">sticks.</span>
        </h2>

        <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: '#94a3b8' }}>
          Quizzes, flashcards, study guides, and more — built for grades 1–8. Use them at home or assign them to a class. Everything is auto-graded and free.
        </p>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {['📖 Learning Stories', '🧠 Quiz Generator', '🎓 Grades 1–8', '✅ Auto-graded'].map(tag => (
            <span key={tag} className="bg-white/8 border border-white/15 text-white/70 text-xs font-medium px-3 py-1.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        <div className="pt-2">
          <Link
            href="/learning"
            className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-8 py-3.5 rounded-full text-base transition-all active:scale-[0.98] shadow-lg shadow-indigo-900/40"
          >
            Explore Learning Tools →
          </Link>
        </div>

        <p className="text-xs" style={{ color: '#475569' }}>No account required · Works on any device</p>
      </div>
    </section>
  )
}

// ── How it works ──────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6">
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
              <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-2xl mx-auto">
                {step.emoji}
              </div>
              <div className="text-xs font-bold text-brand-400 uppercase tracking-widest">
                Step {i + 1}
              </div>
              <h3 className="font-serif text-lg text-oxford">{step.title}</h3>
              <p className="text-sm text-charcoal-light leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    emoji: '✏️',
    title: 'Tell us about your child',
    description: "Their name, age, what they love — the more you share, the more personal the story feels.",
  },
  {
    emoji: '✨',
    title: 'We write & illustrate',
    description: 'Our AI writes a unique story and creates illustrations styled exactly how you want.',
  },
  {
    emoji: '📖',
    title: 'Read & share',
    description: 'Your finished storybook is ready to read online and share instantly. Download the full PDF on paid plans.',
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
              <div className="text-2xl shrink-0 mt-0.5">{feature.emoji}</div>
              <div>
                <h3 className="font-semibold text-oxford text-sm mb-1">{feature.title}</h3>
                <p className="text-xs text-charcoal-light leading-relaxed">{feature.description}</p>
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
    emoji: '🎨',
    title: '5 illustration styles',
    description: 'Choose from watercolor, cartoon, classic storybook, pencil sketch, or digital art.',
  },
  {
    emoji: '📝',
    title: 'Up to 32 pages',
    description: 'Short bedtime story or a full adventure — you control the length.',
  },
  {
    emoji: '💌',
    title: 'Dedication page',
    description: 'Add a personal message printed on the opening page of the book.',
  },
  {
    emoji: '📄',
    title: 'Full PDF download',
    description: 'Download and keep your story forever. Print at home or at any print shop. Included on all paid plans.',
  },
  {
    emoji: '🧒',
    title: 'Truly personalized',
    description: "The story is written around your child's name, age, personality, and interests.",
  },
  {
    emoji: '⚡',
    title: 'Ready in minutes',
    description: 'No waiting days. Your story is generated and ready to read almost instantly.',
  },
]

// ── Pricing ───────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
            Simple, honest pricing
          </h2>
          <p className="text-charcoal-light max-w-md mx-auto">
            All plans are free during beta. Payments coming soon.
          </p>
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
                    {plan.pricingType === 'free' ? (
                      'Free'
                    ) : plan.pricingType === 'one_time' ? (
                      <>${plan.priceMonthly}<span className="text-sm font-normal text-charcoal-light"> once</span></>
                    ) : (
                      <>${plan.priceMonthly}<span className="text-sm font-normal text-charcoal-light">/mo</span></>
                    )}
                  </p>
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
      </div>
    </section>
  )
}

// ── Educator banner ───────────────────────────────────────────────────────────

function EducatorBanner() {
  return (
    <section className="px-6 pb-16">
      <div className="max-w-5xl mx-auto bg-oxford/5 border border-oxford/20 rounded-2xl px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <p className="text-xs font-bold text-oxford uppercase tracking-widest mb-1">For Educators</p>
          <h3 className="font-serif text-xl text-oxford mb-1">A free teacher dashboard, ready today.</h3>
          <p className="text-sm text-charcoal max-w-md">
            Create a class, share a join code, and start assigning quizzes and learning tools in minutes. Track every student&apos;s progress and scores in one place. Free for teachers, always.
          </p>
        </div>
        <div className="shrink-0">
          <Link href="/classroom" className="inline-block bg-oxford hover:bg-oxford/90 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors">
            Try Classroom free →
          </Link>
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

