import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { getSetting } from '@/lib/settings/appSettings'

export const metadata: Metadata = {
  title: 'Learning Tools — Nest & Quill',
  description:
    'AI-powered learning tools for kids in grades 1–8. Quizzes, flashcards, study guides, spelling practice, math problems, and reading comprehension — all free.',
}

const ALL_TOOLS = [
  {
    href: '/learning/scan-homework',
    title: 'Scan Homework',
    desc: 'Snap a photo of any worksheet or textbook page — instantly get flashcards, explanations, study guides, spelling practice, or trivia.',
    tag: 'New',
    color: 'rose',
    flag: 'scan_homework',
  },
  {
    href: '/learning/quiz',
    title: 'Quiz Generator',
    desc: 'Type any topic or snap a photo of homework — get a 5-question quiz instantly.',
    tag: 'Photo upload',
    color: 'indigo',
    flag: null,
  },
  {
    href: '/learning/flashcards',
    title: 'Flashcards',
    desc: 'Any topic or photo → 10 study cards. Tap to flip. Mark what you know.',
    tag: 'Photo upload',
    color: 'violet',
    flag: null,
  },
  {
    href: '/learning/explain',
    title: 'Concept Explainer',
    desc: 'Ask about anything or upload a photo. Get a simple explanation, a real-world analogy, and something to try at home.',
    tag: 'Photo upload',
    color: 'amber',
    flag: null,
  },
  {
    href: '/learning/study-guide',
    title: 'Study Guide',
    desc: 'Key terms, main concepts, memory tips, and practice questions — from any topic or photo.',
    tag: 'Photo upload',
    color: 'emerald',
    flag: null,
  },
  {
    href: '/learning/spelling',
    title: 'Spelling Practice',
    desc: 'Paste your word list from school. Practice one at a time, track your score.',
    tag: 'No AI needed',
    color: 'pink',
    flag: null,
  },
  {
    href: '/learning/math',
    title: 'Math Practice',
    desc: 'Pick a topic and grade — get 8 problems with step-by-step solutions.',
    tag: null,
    color: 'blue',
    flag: null,
  },
  {
    href: '/learning/reading',
    title: 'Reading Comprehension',
    desc: 'Paste any passage and get 5 questions — literal and inferential.',
    tag: null,
    color: 'teal',
    flag: null,
  },
]

const COLOR_MAP: Record<string, { border: string; bg: string; tag: string }> = {
  rose: { border: 'hover:border-rose-300', bg: 'bg-rose-50', tag: 'bg-rose-100 text-rose-700' },
  indigo: { border: 'hover:border-indigo-300', bg: 'bg-indigo-50', tag: 'bg-indigo-100 text-indigo-700' },
  violet: { border: 'hover:border-violet-300', bg: 'bg-violet-50', tag: 'bg-violet-100 text-violet-700' },
  amber: { border: 'hover:border-amber-300', bg: 'bg-amber-50', tag: 'bg-amber-100 text-amber-700' },
  emerald: { border: 'hover:border-emerald-300', bg: 'bg-emerald-50', tag: 'bg-emerald-100 text-emerald-700' },
  pink: { border: 'hover:border-pink-300', bg: 'bg-pink-50', tag: 'bg-pink-100 text-pink-700' },
  blue: { border: 'hover:border-blue-300', bg: 'bg-blue-50', tag: 'bg-blue-100 text-blue-700' },
  teal: { border: 'hover:border-teal-300', bg: 'bg-teal-50', tag: 'bg-teal-100 text-teal-700' },
}

export default async function LearningPage() {
  const scanEnabled = await getSetting('scan_homework_enabled', true)
  const TOOLS = ALL_TOOLS.filter((t) => t.flag !== 'scan_homework' || scanEnabled)

  return (
    <div className="min-h-dvh bg-parchment flex flex-col">
      <SiteHeader
        right={
          <Link href="/" className="text-sm text-charcoal-light hover:text-oxford">
            ← Home
          </Link>
        }
      />

      <main className="flex-1 overflow-y-auto">
        {/* Hero */}
        <section className="bg-oxford py-20 px-6 text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-900/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-brand-900/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl mx-auto relative space-y-5">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
              Free for grades 1–8
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl text-white leading-tight text-balance">
              Help your child practice and{' '}
              <span className="text-indigo-300 italic">learn better.</span>
            </h1>

            <p className="text-lg max-w-xl mx-auto leading-relaxed" style={{ color: '#94a3b8' }}>
              8 free AI-powered learning tools. Quizzes, flashcards, study guides,
              math practice, and more — ready in seconds. No account required.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="#tools"
                className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-7 py-3.5 rounded-full text-base transition-all active:scale-[0.98] shadow-md shadow-indigo-900/30"
              >
                Start learning free →
              </Link>

              <Link
                href="#tools"
                className="bg-white/10 hover:bg-white/15 text-white font-semibold px-7 py-3.5 rounded-full text-base border border-white/20 transition-colors"
              >
                See all tools
              </Link>
            </div>

            <p className="text-xs pt-1" style={{ color: '#475569' }}>
              No account required · Works on any device
            </p>
          </div>
        </section>

        {/* Who it helps */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Built for the way kids actually learn
              </h2>
              <p className="text-charcoal-light max-w-lg mx-auto">
                Whether it&apos;s homework help, test prep, or daily practice — these
                tools meet your child where they are.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  title: 'Parents',
                  desc: 'Give your child extra practice on any topic without searching for worksheets or buying workbooks.',
                },
                {
                  title: 'Homeschool families',
                  desc: 'Generate quizzes, flashcards, and study materials for any subject in seconds.',
                },
                {
                  title: 'Students',
                  desc: 'Study smarter with auto-generated tools that adapt to your grade level and topic.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-parchment rounded-2xl border border-gray-100 px-6 py-6 space-y-3"
                >
                  <h3 className="font-semibold text-oxford">{item.title}</h3>
                  <p className="text-sm text-charcoal-light leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tools grid */}
        <section id="tools" className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Every tool your child needs
              </h2>
              <p className="text-charcoal-light max-w-md mx-auto">
                Pick a tool, enter a topic, and get instant learning material.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TOOLS.map((tool) => {
                const c = COLOR_MAP[tool.color]
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className={`bg-white rounded-2xl border-2 border-gray-100 ${c.border} px-5 py-5 flex flex-col gap-3 transition-all hover:shadow-md group`}
                  >
                    <div className={`w-12 h-12 ${c.bg} rounded-2xl flex items-center justify-center`} />

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-oxford text-sm">
                          {tool.title}
                        </p>
                        {tool.tag && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${c.tag}`}>
                            {tool.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-charcoal-light leading-relaxed">
                        {tool.desc}
                      </p>
                    </div>

                    <span className="text-xs font-semibold text-gray-400 group-hover:text-gray-600 transition-colors">
                      Open →
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                How it works
              </h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  n: '1',
                  title: 'Pick a tool',
                  desc: 'Choose from quizzes, flashcards, study guides, math practice, spelling, or reading comprehension.',
                },
                {
                  n: '2',
                  title: 'Enter a topic',
                  desc: 'Type any subject or snap a photo of homework. Set the grade level and go.',
                },
                {
                  n: '3',
                  title: 'Practice instantly',
                  desc: 'Get auto-generated, auto-graded learning material in seconds. Track what you know.',
                },
              ].map((step) => (
                <div key={step.n} className="text-center space-y-3">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl mx-auto font-bold text-indigo-500">
                    {step.n}
                  </div>
                  <h3 className="font-serif text-lg text-oxford">{step.title}</h3>
                  <p className="text-sm text-charcoal-light leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Why parents love it
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {[
                {
                  title: 'No prep work for you',
                  desc: 'Just type a topic and the tool does the rest. No searching for worksheets or buying workbooks.',
                },
                {
                  title: 'Grade-level appropriate',
                  desc: 'Content adjusts to grades 1–8. Your child gets material that matches where they are.',
                },
                {
                  title: 'Auto-graded',
                  desc: 'Quizzes and practice sets are scored automatically. You see results immediately.',
                },
                {
                  title: 'Works on any device',
                  desc: 'Phone, tablet, laptop, or desktop. No app to install. Just open and start.',
                },
                {
                  title: 'Photo upload support',
                  desc: 'Snap a picture of homework, a textbook page, or worksheet — and get learning tools from it instantly.',
                },
                {
                  title: 'Free during beta',
                  desc: 'All learning tools are completely free right now. No credit card, no account required.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5"
                >
                  <h3 className="font-semibold text-oxford text-sm mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-charcoal-light leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Grades / subjects */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
              Covers every subject
            </h2>
            <p className="text-charcoal-light max-w-lg mx-auto mb-10">
              Works for any topic your child is studying. Here are some popular ones.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              {[
                'Math',
                'Science',
                'History',
                'English',
                'Reading',
                'Spelling',
                'Geography',
                'Social Studies',
                'Vocabulary',
                'Grammar',
                'Writing',
                'Art History',
              ].map((subject) => (
                <span
                  key={subject}
                  className="bg-indigo-50 text-indigo-700 text-sm font-medium px-4 py-2 rounded-full border border-indigo-100"
                >
                  {subject}
                </span>
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
                  q: 'Is this really free?',
                  a: 'Yes. All learning tools are free during beta. No credit card or account required.',
                },
                {
                  q: 'What grades does it cover?',
                  a: 'All tools are designed for grades 1–8. You select the grade level when generating content.',
                },
                {
                  q: 'Do I need to create an account?',
                  a: 'No. You can use any tool immediately without signing up. An account is only needed for classroom features.',
                },
                {
                  q: 'Can I use this for homeschool?',
                  a: 'Absolutely. Many homeschool families use these tools to generate quizzes, flashcards, and practice material for any topic.',
                },
                {
                  q: 'How is content generated?',
                  a: 'Our AI creates age-appropriate, grade-level content based on the topic you provide. Every quiz, flashcard set, and study guide is unique.',
                },
              ].map((item) => (
                <div key={item.q} className="border-b border-gray-100 pb-6">
                  <h3 className="font-semibold text-oxford text-sm mb-2">
                    {item.q}
                  </h3>
                  <p className="text-sm text-charcoal-light leading-relaxed">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Learning Stories callout */}
        <section className="px-6 pb-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-brand-50 border border-brand-200 rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-oxford text-sm">
                  Also: Learning Stories
                </p>
                <p className="text-xs text-charcoal-light">
                  A personalized illustrated storybook with your child&apos;s topic
                  woven in — plus a quiz at the end.
                </p>
              </div>
              <Link
                href="/create?mode=learning"
                className="shrink-0 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors whitespace-nowrap"
              >
                Create a Learning Story →
              </Link>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="bg-indigo-600 py-20 px-6 text-center">
          <div className="max-w-2xl mx-auto space-y-5">
            <h2 className="font-serif text-3xl sm:text-4xl text-white leading-tight">
              Learning should be simple.
            </h2>
            <p className="text-indigo-100 text-base">
              Pick a tool, enter a topic, and let your child start practicing —
              free, no sign-up needed.
            </p>
            <Link
              href="#tools"
              className="inline-block bg-white text-indigo-700 font-semibold px-8 py-3.5 rounded-full text-base hover:bg-indigo-50 transition-colors shadow-lg"
            >
              Start learning free →
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
