import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export const metadata: Metadata = {
  title: 'Homeschool Curriculum — Nest & Quill',
  description:
    'A complete K–12 homeschool curriculum powered by AI. Quizzes, flashcards, study guides, and full courses for every subject — structured, standards-aligned, and free during beta.',
}

export default function HomeschoolPage() {
  return (
    <div className="min-h-dvh bg-parchment font-sans flex flex-col">
      <SiteHeader
        right={
          <Link
            href="/learning"
            className="bg-brand-500 hover:bg-brand-600 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-colors whitespace-nowrap"
          >
            Try Learning Tools →
          </Link>
        }
      />

      <main className="flex-1 overflow-y-auto">
        {/* Hero */}
        <section className="bg-oxford py-24 px-6 text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-900/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-brand-900/15 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl mx-auto relative space-y-6">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Free during beta
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl text-white leading-tight text-balance">
              A complete homeschool curriculum{' '}
              <span className="text-emerald-300 italic">that builds itself.</span>
            </h1>

            <p className="text-lg max-w-xl mx-auto leading-relaxed" style={{ color: '#94a3b8' }}>
              Structured courses for grades 1–12 across every core subject.
              AI-generated lessons, quizzes, and study materials — organized by
              week, unit, and standard. No textbooks required.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/homeschool/courses"
                className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-7 py-3.5 rounded-full text-base transition-all active:scale-[0.98] shadow-lg shadow-emerald-900/30"
              >
                Browse course catalog →
              </Link>
              <Link
                href="/learning"
                className="bg-white/10 hover:bg-white/15 text-white font-semibold px-7 py-3.5 rounded-full text-base border border-white/20 transition-colors"
              >
                Try tools free
              </Link>
            </div>

            <p className="text-xs pt-1" style={{ color: '#475569' }}>
              No credit card · No textbooks · Works on any device
            </p>
          </div>
        </section>

        {/* What you get */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Everything a homeschool family needs
              </h2>
              <p className="text-charcoal-light max-w-lg mx-auto">
                Stop piecing together worksheets from 10 different websites.
                Get a structured, complete curriculum in one place.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  title: 'Structured courses',
                  desc: 'Full-year courses organized into units and weekly lessons for grades 1–12.',
                  color: 'bg-emerald-50 border-emerald-100',
                },
                {
                  title: 'Every core subject',
                  desc: 'Math, English, Science, Social Studies, and History — all grade-level appropriate.',
                  color: 'bg-blue-50 border-blue-100',
                },
                {
                  title: 'AI-powered lessons',
                  desc: 'Quizzes, flashcards, study guides, and practice problems generated for each topic.',
                  color: 'bg-violet-50 border-violet-100',
                },
                {
                  title: 'Weekly pacing',
                  desc: 'Each unit is mapped to specific weeks so you always know what to teach next.',
                  color: 'bg-amber-50 border-amber-100',
                },
                {
                  title: 'Auto-graded',
                  desc: 'Quizzes and practice sets are scored automatically. No manual grading.',
                  color: 'bg-rose-50 border-rose-100',
                },
                {
                  title: 'Progress tracking',
                  desc: 'See what your child has completed, scores on every activity, and overall progress.',
                  color: 'bg-indigo-50 border-indigo-100',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className={`${item.color} border rounded-2xl px-6 py-5 space-y-2`}
                >
                  <h3 className="font-semibold text-oxford text-sm">{item.title}</h3>
                  <p className="text-xs text-charcoal-light leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Curriculum overview */}
        <section id="curriculum" className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Grades 1–8, every subject
              </h2>
              <p className="text-charcoal-light max-w-lg mx-auto">
                Each grade has full-year courses with units, lessons, and activities.
                Here is what is covered.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  grade: 'Grades 1–2',
                  subjects: 'Math, English Language Arts, Science, Social Studies',
                  sample: 'Counting, phonics, sight words, weather, seasons, community helpers',
                },
                {
                  grade: 'Grades 3–4',
                  subjects: 'Math, English Language Arts, Science, Social Studies, History',
                  sample: 'Multiplication, fractions, reading comprehension, ecosystems, early American history',
                },
                {
                  grade: 'Grades 5–6',
                  subjects: 'Math, English Language Arts, Science, Social Studies, History',
                  sample: 'Decimals, essay writing, solar system, ancient civilizations, ratios',
                },
                {
                  grade: 'Grades 7–8',
                  subjects: 'Math, English Language Arts, Science, Social Studies, History',
                  sample: 'Linear equations, literary analysis, genetics, Civil War, persuasive writing',
                },
                {
                  grade: 'Grades 9–10',
                  subjects: 'Algebra, Geometry, Biology, Chemistry, English, World History',
                  sample: 'Polynomials, proofs, cell biology, chemical reactions, rhetoric, ancient civilizations',
                },
                {
                  grade: 'Grades 11–12',
                  subjects: 'Algebra II, Pre-Calculus, Physics, Environmental Science, US History, Government',
                  sample: 'Logarithms, trigonometry, forces and energy, ecosystems, Constitutional law, economics',
                },
              ].map((row) => (
                <div key={row.grade} className="bg-white rounded-2xl border border-gray-100 px-6 py-5 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-bold text-oxford">{row.grade}</h3>
                    <span className="text-xs text-charcoal-light shrink-0">{row.subjects}</span>
                  </div>
                  <p className="text-xs text-charcoal-light leading-relaxed">
                    Sample topics: {row.sample}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                How it works for your family
              </h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  n: '1',
                  title: 'Pick a grade and subject',
                  desc: 'Choose your child\'s grade level and the subjects you want to cover this year.',
                },
                {
                  n: '2',
                  title: 'Follow the weekly plan',
                  desc: 'Each course is organized into units with weekly lessons. Work through them at your own pace.',
                },
                {
                  n: '3',
                  title: 'Track progress',
                  desc: 'See scores, completion rates, and what your child has mastered across every subject.',
                },
              ].map((step) => (
                <div key={step.n} className="text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-2xl mx-auto font-bold text-emerald-500">
                    {step.n}
                  </div>
                  <h3 className="font-serif text-lg text-oxford">{step.title}</h3>
                  <p className="text-sm text-charcoal-light leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Scan homework upsell */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-50 border border-gray-200 rounded-3xl overflow-hidden">
              <div className="grid md:grid-cols-2 gap-0">
                <div className="px-8 py-10 md:px-10 space-y-5">
                  <div className="inline-flex items-center gap-2 bg-oxford/10 text-oxford text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-oxford animate-pulse inline-block" />
                    Exclusive feature
                  </div>

                  <h2 className="font-serif text-2xl sm:text-3xl text-oxford leading-tight">
                    Already have materials?{' '}
                    <span className="text-charcoal-light italic">Scan them in.</span>
                  </h2>

                  <p className="text-sm text-charcoal-light leading-relaxed max-w-md">
                    Photograph any worksheet, textbook page, or handwritten notes and
                    instantly turn them into quizzes, flashcards, study guides, and
                    more. Build your curriculum from what you already have.
                  </p>

                  <Link
                    href="/learning/scan-homework"
                    className="inline-flex items-center gap-2 bg-oxford hover:bg-oxford/90 text-white font-semibold px-6 py-3 rounded-full text-sm transition-all"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <path d="M3 9V6a3 3 0 013-3h3M21 9V6a3 3 0 00-3-3h-3M3 15v3a3 3 0 003 3h3M21 15v3a3 3 0 01-3 3h-3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Try Scan Homework
                  </Link>
                </div>

                <div className="px-8 py-8 md:px-6 md:py-10 grid grid-cols-2 gap-2.5 content-center">
                  {[
                    { title: 'Flashcards', desc: 'From any page' },
                    { title: 'Trivia Game', desc: 'Timed practice' },
                    { title: 'Study Guide', desc: 'Key concepts' },
                    { title: 'Full Quiz', desc: 'Auto-graded' },
                  ].map((card) => (
                    <div key={card.title} className="bg-white border border-gray-200 rounded-xl px-3.5 py-3 space-y-0.5">
                      <p className="text-xs font-bold text-oxford">{card.title}</p>
                      <p className="text-[10px] text-charcoal-light">{card.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Why families switch to Nest &amp; Quill
              </h2>
            </div>

            <div className="space-y-4">
              {[
                'No more piecing together worksheets from 5 different websites.',
                'No expensive textbook sets to buy and store.',
                'No manual grading — everything is scored automatically.',
                'No rigid schedule — work at your own pace, on your own time.',
                'No complicated setup — just pick a grade and start.',
                'Content grows with your child — always grade-appropriate.',
              ].map((item) => (
                <div key={item} className="flex gap-3 items-start bg-parchment rounded-xl px-5 py-4 border border-gray-100">
                  <span className="text-emerald-500 font-bold shrink-0 mt-px">✓</span>
                  <p className="text-sm text-charcoal leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-3xl text-oxford mb-10 text-center">
              Common questions
            </h2>

            <div className="space-y-6">
              {[
                {
                  q: 'Is this a full curriculum or supplemental?',
                  a: 'It is designed to be a complete curriculum for grades 1–12 covering all core subjects. You can also use individual tools as supplemental practice alongside another program.',
                },
                {
                  q: 'Is the content standards-aligned?',
                  a: 'Yes. Our curriculum is structured around common educational standards for each grade level. We are working toward formal accreditation.',
                },
                {
                  q: 'How much does it cost?',
                  a: 'During beta, everything is free. After beta, we will offer monthly plans for full curriculum access. Individual learning tools will remain free.',
                },
                {
                  q: 'Can I customize the curriculum?',
                  a: 'Yes. You can skip units, reorder lessons, add topics, and supplement with scanned materials from your own resources.',
                },
                {
                  q: 'Do you track progress and grades?',
                  a: 'Yes. Every quiz score, completed activity, and study session is tracked. You can see overall progress by subject, unit, and week.',
                },
                {
                  q: 'Can I use this for multiple children?',
                  a: 'Yes. Each child can have their own account at their own grade level. You can manage multiple children from a parent or educator account.',
                },
                {
                  q: 'What about accreditation?',
                  a: 'We are building our curriculum with accreditation standards in mind. All content is reviewable, editable, and mapped to educational standards. Formal accreditation is on our roadmap.',
                },
              ].map((item) => (
                <div key={item.q} className="border-b border-gray-100 pb-6">
                  <h3 className="font-semibold text-oxford text-sm mb-2">{item.q}</h3>
                  <p className="text-sm text-charcoal-light leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="bg-emerald-600 py-20 px-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent_70%)]" />
          <div className="max-w-2xl mx-auto space-y-5 relative">
            <h2 className="font-serif text-3xl sm:text-4xl text-white leading-tight">
              Your homeschool curriculum is ready.
            </h2>
            <p className="text-emerald-100 text-base">
              Structured courses, AI-powered lessons, and automatic grading — free during beta.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/learning"
                className="inline-block bg-white text-emerald-700 font-semibold px-8 py-3.5 rounded-full text-base hover:bg-emerald-50 transition-colors shadow-lg"
              >
                Start learning free →
              </Link>
              <Link
                href="/classroom"
                className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-3.5 rounded-full text-base border border-emerald-400 transition-colors"
              >
                Set up a classroom
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
