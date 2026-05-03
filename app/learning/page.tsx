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

const LEARNING_TOOLS = [
  {
    href: '/learning/quiz',
    title: 'Quiz Generator',
    desc: 'Type any topic — get a 5-question quiz with instant grading.',
    icon: '?',
    gradient: 'from-indigo-500 to-blue-500',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-200 hover:border-indigo-400',
    iconBg: 'bg-indigo-500',
    tag: 'Photo upload',
    tagColor: 'bg-indigo-100 text-indigo-700',
  },
  {
    href: '/learning/flashcards',
    title: 'Flashcards',
    desc: 'Any topic → 10 study cards. Tap to flip. Track what you know.',
    icon: 'F',
    gradient: 'from-violet-500 to-purple-500',
    bg: 'bg-violet-500/10',
    border: 'border-violet-200 hover:border-violet-400',
    iconBg: 'bg-violet-500',
    tag: 'Photo upload',
    tagColor: 'bg-violet-100 text-violet-700',
  },
  {
    href: '/learning/explain',
    title: 'Concept Explainer',
    desc: 'Get a simple explanation, real-world analogy, and something to try.',
    icon: '!',
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-200 hover:border-amber-400',
    iconBg: 'bg-amber-500',
    tag: 'Photo upload',
    tagColor: 'bg-amber-100 text-amber-700',
  },
  {
    href: '/learning/study-guide',
    title: 'Study Guide',
    desc: 'Key terms, concepts, memory tips, and practice questions.',
    icon: 'S',
    gradient: 'from-emerald-500 to-green-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-200 hover:border-emerald-400',
    iconBg: 'bg-emerald-500',
    tag: 'Photo upload',
    tagColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    href: '/learning/spelling',
    title: 'Spelling Practice',
    desc: 'Paste your word list. Practice one at a time, track your score.',
    icon: 'A',
    gradient: 'from-pink-500 to-rose-500',
    bg: 'bg-pink-500/10',
    border: 'border-pink-200 hover:border-pink-400',
    iconBg: 'bg-pink-500',
    tag: null,
    tagColor: '',
  },
  {
    href: '/learning/math',
    title: 'Math Practice',
    desc: 'Pick a topic and grade — get 8 problems with step-by-step answers.',
    icon: '+',
    gradient: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-200 hover:border-blue-400',
    iconBg: 'bg-blue-500',
    tag: null,
    tagColor: '',
  },
  {
    href: '/learning/reading',
    title: 'Reading Comprehension',
    desc: 'Paste any passage and get 5 questions — literal and inferential.',
    icon: 'R',
    gradient: 'from-teal-500 to-emerald-500',
    bg: 'bg-teal-500/10',
    border: 'border-teal-200 hover:border-teal-400',
    iconBg: 'bg-teal-500',
    tag: null,
    tagColor: '',
  },
]

export default async function LearningPage() {
  const scanEnabled = await getSetting('scan_homework_enabled', true)

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
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-violet-900/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-800/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl mx-auto relative space-y-5">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
              Free for grades 1–8
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl text-white leading-tight text-balance">
              Learn, play, and{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-violet-300 italic">
                level up.
              </span>
            </h1>

            <p className="text-lg max-w-xl mx-auto leading-relaxed" style={{ color: '#94a3b8' }}>
              8 free learning tools that make studying feel like a game.
              Earn XP, collect badges, and build streaks — all while mastering
              any subject.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="#scan"
                className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-semibold px-7 py-3.5 rounded-full text-base transition-all active:scale-[0.98] shadow-lg shadow-indigo-900/40"
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

            {/* Floating reward tags */}
            <div className="flex justify-center gap-3 pt-4 flex-wrap">
              {['Earn XP', 'Collect badges', 'Build streaks', 'Unlock rewards'].map((tag) => (
                <span key={tag} className="bg-white/8 border border-white/15 text-white/60 text-xs font-medium px-3 py-1.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── SCAN HOMEWORK — Hero Feature ── */}
        {scanEnabled && (
          <section id="scan" className="relative overflow-hidden">
            {/* Gradient background */}
            <div className="bg-gradient-to-br from-rose-500 via-pink-500 to-violet-600 py-20 px-6 relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_70%)]" />
              <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-violet-400/10 rounded-full blur-3xl" />

              <div className="max-w-5xl mx-auto relative">
                <div className="grid md:grid-cols-2 gap-10 items-center">
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block" />
                      Only on Nest &amp; Quill
                    </div>

                    <h2 className="font-serif text-4xl sm:text-5xl text-white leading-tight">
                      Scan any homework.{' '}
                      <span className="text-rose-200 italic">Instantly learn from it.</span>
                    </h2>

                    <p className="text-lg text-white/80 leading-relaxed max-w-md">
                      Snap a photo of any worksheet, textbook page, or handwritten notes —
                      and choose how you want to study it. No other platform does this.
                    </p>

                    <Link
                      href="/learning/scan-homework"
                      className="inline-flex items-center gap-2 bg-white hover:bg-rose-50 text-rose-600 font-bold px-8 py-4 rounded-full text-base transition-all active:scale-[0.98] shadow-xl shadow-rose-900/30"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
                        <path d="M3 9V6a3 3 0 013-3h3M21 9V6a3 3 0 00-3-3h-3M3 15v3a3 3 0 003 3h3M21 15v3a3 3 0 01-3 3h-3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Scan Homework Now
                    </Link>
                  </div>

                  {/* Feature cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { title: 'Flashcards', desc: 'Auto-generate study cards from the page', color: 'bg-violet-500/30' },
                      { title: 'Trivia Game', desc: 'Rapid-fire questions with a timer', color: 'bg-pink-500/30' },
                      { title: 'Study Guide', desc: 'Key terms, concepts, and practice Qs', color: 'bg-rose-500/30' },
                      { title: 'Explain It', desc: 'Plain-language breakdown of the content', color: 'bg-fuchsia-500/30' },
                      { title: 'Spelling', desc: 'Extract words and practice spelling', color: 'bg-amber-500/30' },
                      { title: 'Quiz', desc: 'Full 5-question auto-graded quiz', color: 'bg-indigo-500/30' },
                    ].map((card) => (
                      <div key={card.title} className={`${card.color} backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3.5 space-y-1`}>
                        <p className="text-sm font-bold text-white">{card.title}</p>
                        <p className="text-xs text-white/70 leading-relaxed">{card.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom tagline */}
                <div className="mt-10 text-center">
                  <p className="text-sm text-white/50">
                    Works with worksheets, textbooks, handwritten notes, and printed materials
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Gamification callout ── */}
        <section className="py-16 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Learning that feels like a game
              </h2>
              <p className="text-charcoal-light max-w-lg mx-auto">
                Every quiz, flashcard set, and practice session earns rewards.
                The more you learn, the more you unlock.
              </p>
            </div>

            <div className="grid sm:grid-cols-4 gap-4">
              {[
                {
                  label: 'Earn XP',
                  desc: 'Every activity earns experience points that level you up.',
                  color: 'from-indigo-500 to-blue-500',
                  iconBg: 'bg-indigo-100',
                  icon: 'XP',
                },
                {
                  label: 'Collect Badges',
                  desc: 'Complete challenges to unlock unique badges for your profile.',
                  color: 'from-amber-500 to-orange-500',
                  iconBg: 'bg-amber-100',
                  icon: 'B',
                },
                {
                  label: 'Build Streaks',
                  desc: 'Practice daily to build your streak and earn bonus rewards.',
                  color: 'from-rose-500 to-pink-500',
                  iconBg: 'bg-rose-100',
                  icon: 'S',
                },
                {
                  label: 'Level Up',
                  desc: 'Climb the ranks and show off your progress to classmates.',
                  color: 'from-emerald-500 to-green-500',
                  iconBg: 'bg-emerald-100',
                  icon: 'L',
                },
              ].map((item) => (
                <div key={item.label} className="text-center space-y-3">
                  <div className={`w-14 h-14 ${item.iconBg} rounded-2xl flex items-center justify-center mx-auto`}>
                    <span className={`text-lg font-black bg-gradient-to-r ${item.color} text-transparent bg-clip-text`}>
                      {item.icon}
                    </span>
                  </div>
                  <h3 className="font-bold text-oxford text-sm">{item.label}</h3>
                  <p className="text-xs text-charcoal-light leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Tools grid — colorful and animated ── */}
        <section id="tools" className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Pick your tool, start practicing
              </h2>
              <p className="text-charcoal-light max-w-md mx-auto">
                Every tool earns XP. Complete them all to unlock special badges.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {LEARNING_TOOLS.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className={`relative bg-white rounded-2xl border-2 ${tool.border} px-5 py-5 flex flex-col gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 group overflow-hidden`}
                >
                  {/* Gradient accent on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity`} />

                  <div className="flex items-center gap-3 relative">
                    <div className={`w-11 h-11 ${tool.iconBg} rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm`}>
                      {tool.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-oxford text-sm">{tool.title}</p>
                        {tool.tag && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${tool.tagColor}`}>
                            {tool.tag}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-charcoal-light leading-relaxed relative">
                    {tool.desc}
                  </p>

                  <div className="flex items-center justify-between relative">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">+50 XP</span>
                    <span className="text-xs font-bold text-gray-400 group-hover:text-gray-600 transition-colors group-hover:translate-x-0.5 transform">
                      Open →
                    </span>
                  </div>
                </Link>
              ))}
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
                  color: 'from-indigo-500 to-violet-500',
                },
                {
                  n: '2',
                  title: 'Enter a topic',
                  desc: 'Type any subject or snap a photo of homework. Set the grade level and go.',
                  color: 'from-violet-500 to-pink-500',
                },
                {
                  n: '3',
                  title: 'Practice and earn',
                  desc: 'Complete activities to earn XP, collect badges, and build your streak. Track your progress.',
                  color: 'from-pink-500 to-rose-500',
                },
              ].map((step) => (
                <div key={step.n} className="text-center space-y-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center text-xl mx-auto font-bold text-white shadow-sm`}>
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
                { name: 'Math', color: 'bg-blue-50 text-blue-700 border-blue-100' },
                { name: 'Science', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                { name: 'History', color: 'bg-amber-50 text-amber-700 border-amber-100' },
                { name: 'English', color: 'bg-violet-50 text-violet-700 border-violet-100' },
                { name: 'Reading', color: 'bg-teal-50 text-teal-700 border-teal-100' },
                { name: 'Spelling', color: 'bg-pink-50 text-pink-700 border-pink-100' },
                { name: 'Geography', color: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
                { name: 'Social Studies', color: 'bg-orange-50 text-orange-700 border-orange-100' },
                { name: 'Vocabulary', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
                { name: 'Grammar', color: 'bg-rose-50 text-rose-700 border-rose-100' },
                { name: 'Writing', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100' },
                { name: 'Art History', color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
              ].map((subject) => (
                <span
                  key={subject.name}
                  className={`${subject.color} text-sm font-medium px-4 py-2 rounded-full border`}
                >
                  {subject.name}
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
                  a: 'No. You can use any tool immediately without signing up. An account is only needed for classroom features and progress tracking.',
                },
                {
                  q: 'How does the XP and badge system work?',
                  a: 'Every activity you complete earns XP. As you accumulate XP, you level up and unlock badges. Practice daily to build your streak and earn bonus rewards.',
                },
                {
                  q: 'What makes Scan Homework special?',
                  a: 'No other platform lets you photograph homework and instantly turn it into 6 different learning activities. One photo becomes flashcards, trivia, study guides, explanations, spelling practice, or a full quiz.',
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
        <section className="bg-gradient-to-r from-indigo-600 to-violet-600 py-20 px-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent_70%)]" />
          <div className="max-w-2xl mx-auto space-y-5 relative">
            <h2 className="font-serif text-3xl sm:text-4xl text-white leading-tight">
              Ready to start earning XP?
            </h2>
            <p className="text-indigo-100 text-base">
              Pick a tool, enter a topic, and start leveling up — free, no sign-up needed.
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
