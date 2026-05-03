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
                href="#tools"
                className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-semibold px-7 py-3.5 rounded-full text-base transition-all active:scale-[0.98] shadow-lg shadow-indigo-900/40"
              >
                Start learning free →
              </Link>

              <Link
                href="#scan"
                className="bg-white/10 hover:bg-white/15 text-white font-semibold px-7 py-3.5 rounded-full text-base border border-white/20 transition-colors"
              >
                Try Scan Homework
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
                { label: 'Earn XP', desc: 'Every activity earns experience points that level you up.', color: 'from-indigo-500 to-blue-500', iconBg: 'bg-indigo-100', icon: 'XP' },
                { label: 'Collect Badges', desc: 'Complete challenges to unlock unique badges for your profile.', color: 'from-amber-500 to-orange-500', iconBg: 'bg-amber-100', icon: 'B' },
                { label: 'Build Streaks', desc: 'Practice daily to build your streak and earn bonus rewards.', color: 'from-rose-500 to-pink-500', iconBg: 'bg-rose-100', icon: 'S' },
                { label: 'Level Up', desc: 'Climb the ranks and show off your progress to classmates.', color: 'from-emerald-500 to-green-500', iconBg: 'bg-emerald-100', icon: 'L' },
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

        {/* ── Tools grid ── */}
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
              {/* ── Quiz Generator — MOST POPULAR ── */}
              <Link
                href="/learning/quiz"
                className="relative bg-white rounded-2xl border-2 border-indigo-300 hover:border-indigo-500 px-5 py-5 flex flex-col gap-3 transition-all hover:shadow-xl hover:-translate-y-1 group overflow-hidden sm:col-span-2 lg:col-span-1 ring-1 ring-indigo-100"
              >
                <span className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wide">
                  Most Popular
                </span>
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-blue-500 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />
                <div className="flex items-center gap-3 relative">
                  <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center text-white text-xl font-black shrink-0 shadow-md shadow-indigo-200">
                    ?
                  </div>
                  <div>
                    <p className="font-bold text-oxford text-sm">Quiz Generator</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Photo upload</span>
                  </div>
                </div>
                <p className="text-xs text-charcoal-light leading-relaxed relative">
                  Type any topic — get a 5-question quiz with instant grading. The fastest way to test what you know.
                </p>
                <div className="flex items-center justify-between relative">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">+50 XP</span>
                  <span className="text-xs font-bold text-indigo-400 group-hover:text-indigo-600 transition-colors">
                    Start quiz →
                  </span>
                </div>
              </Link>

              {/* ── Flashcards — FAN FAVORITE ── */}
              <Link
                href="/learning/flashcards"
                className="relative bg-white rounded-2xl border-2 border-violet-200 hover:border-violet-400 px-5 py-5 flex flex-col gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 group overflow-hidden"
              >
                <span className="absolute top-0 right-0 bg-violet-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wide">
                  Fan Favorite
                </span>
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-500 opacity-0 group-hover:opacity-[0.03] transition-opacity" />
                <div className="flex items-center gap-3 relative">
                  <div className="w-11 h-11 bg-violet-500 rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm">
                    F
                  </div>
                  <div>
                    <p className="font-bold text-oxford text-sm">Flashcards</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Photo upload</span>
                  </div>
                </div>
                <p className="text-xs text-charcoal-light leading-relaxed relative">
                  Any topic → 10 study cards. Tap to flip. Track what you know.
                </p>
                <div className="flex items-center justify-between relative">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">+50 XP</span>
                  <span className="text-xs font-bold text-gray-400 group-hover:text-gray-600 transition-colors">
                    Open →
                  </span>
                </div>
              </Link>

              {/* ── Study Guide ── */}
              <Link
                href="/learning/study-guide"
                className="relative bg-white rounded-2xl border-2 border-emerald-200 hover:border-emerald-400 px-5 py-5 flex flex-col gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-green-500 opacity-0 group-hover:opacity-[0.03] transition-opacity" />
                <div className="flex items-center gap-3 relative">
                  <div className="w-11 h-11 bg-emerald-500 rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm">
                    S
                  </div>
                  <div>
                    <p className="font-bold text-oxford text-sm">Study Guide</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Photo upload</span>
                  </div>
                </div>
                <p className="text-xs text-charcoal-light leading-relaxed relative">
                  Key terms, concepts, memory tips, and practice questions.
                </p>
                <div className="flex items-center justify-between relative">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">+50 XP</span>
                  <span className="text-xs font-bold text-gray-400 group-hover:text-gray-600 transition-colors">Open →</span>
                </div>
              </Link>

              {/* ── Concept Explainer ── */}
              <Link
                href="/learning/explain"
                className="relative bg-white rounded-2xl border-2 border-amber-200 hover:border-amber-400 px-5 py-5 flex flex-col gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-500 opacity-0 group-hover:opacity-[0.03] transition-opacity" />
                <div className="flex items-center gap-3 relative">
                  <div className="w-11 h-11 bg-amber-500 rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm">
                    !
                  </div>
                  <div>
                    <p className="font-bold text-oxford text-sm">Concept Explainer</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Photo upload</span>
                  </div>
                </div>
                <p className="text-xs text-charcoal-light leading-relaxed relative">
                  Get a simple explanation, real-world analogy, and something to try.
                </p>
                <div className="flex items-center justify-between relative">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">+50 XP</span>
                  <span className="text-xs font-bold text-gray-400 group-hover:text-gray-600 transition-colors">Open →</span>
                </div>
              </Link>

              {/* ── Math Practice ── */}
              <Link
                href="/learning/math"
                className="relative bg-white rounded-2xl border-2 border-blue-200 hover:border-blue-400 px-5 py-5 flex flex-col gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-[0.03] transition-opacity" />
                <div className="flex items-center gap-3 relative">
                  <div className="w-11 h-11 bg-blue-500 rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm">
                    +
                  </div>
                  <p className="font-bold text-oxford text-sm">Math Practice</p>
                </div>
                <p className="text-xs text-charcoal-light leading-relaxed relative">
                  Pick a topic and grade — get 8 problems with step-by-step answers.
                </p>
                <div className="flex items-center justify-between relative">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">+50 XP</span>
                  <span className="text-xs font-bold text-gray-400 group-hover:text-gray-600 transition-colors">Open →</span>
                </div>
              </Link>

              {/* ── Spelling Practice ── */}
              <Link
                href="/learning/spelling"
                className="relative bg-white rounded-2xl border-2 border-pink-200 hover:border-pink-400 px-5 py-5 flex flex-col gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-rose-500 opacity-0 group-hover:opacity-[0.03] transition-opacity" />
                <div className="flex items-center gap-3 relative">
                  <div className="w-11 h-11 bg-pink-500 rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm">
                    A
                  </div>
                  <p className="font-bold text-oxford text-sm">Spelling Practice</p>
                </div>
                <p className="text-xs text-charcoal-light leading-relaxed relative">
                  Paste your word list. Practice one at a time, track your score.
                </p>
                <div className="flex items-center justify-between relative">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">+50 XP</span>
                  <span className="text-xs font-bold text-gray-400 group-hover:text-gray-600 transition-colors">Open →</span>
                </div>
              </Link>

              {/* ── Reading Comprehension ── */}
              <Link
                href="/learning/reading"
                className="relative bg-white rounded-2xl border-2 border-teal-200 hover:border-teal-400 px-5 py-5 flex flex-col gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500 to-emerald-500 opacity-0 group-hover:opacity-[0.03] transition-opacity" />
                <div className="flex items-center gap-3 relative">
                  <div className="w-11 h-11 bg-teal-500 rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm">
                    R
                  </div>
                  <p className="font-bold text-oxford text-sm">Reading Comprehension</p>
                </div>
                <p className="text-xs text-charcoal-light leading-relaxed relative">
                  Paste any passage and get 5 questions — literal and inferential.
                </p>
                <div className="flex items-center justify-between relative">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">+50 XP</span>
                  <span className="text-xs font-bold text-gray-400 group-hover:text-gray-600 transition-colors">Open →</span>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* ── SCAN HOMEWORK — below tools, toned down ── */}
        {scanEnabled && (
          <section id="scan" className="py-20 px-6 bg-white">
            <div className="max-w-5xl mx-auto">
              <div className="bg-gray-50 border border-gray-200 rounded-3xl overflow-hidden">
                <div className="grid md:grid-cols-2 gap-0">
                  {/* Left — copy */}
                  <div className="px-8 py-10 md:px-10 md:py-12 space-y-5">
                    <div className="inline-flex items-center gap-2 bg-oxford/10 text-oxford text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-oxford animate-pulse inline-block" />
                      Only on Nest &amp; Quill
                    </div>

                    <h2 className="font-serif text-3xl sm:text-4xl text-oxford leading-tight">
                      Scan any homework.{' '}
                      <span className="text-charcoal-light italic">Instantly learn from it.</span>
                    </h2>

                    <p className="text-sm text-charcoal-light leading-relaxed max-w-md">
                      Take a photo of any worksheet, textbook page, or handwritten notes —
                      then choose from 6 different ways to study it. No other platform does this.
                    </p>

                    <Link
                      href="/learning/scan-homework"
                      className="inline-flex items-center gap-2 bg-oxford hover:bg-oxford/90 text-white font-semibold px-7 py-3.5 rounded-full text-sm transition-all active:scale-[0.98] shadow-sm"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <path d="M3 9V6a3 3 0 013-3h3M21 9V6a3 3 0 00-3-3h-3M3 15v3a3 3 0 003 3h3M21 15v3a3 3 0 01-3 3h-3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Scan Homework
                    </Link>
                  </div>

                  {/* Right — feature cards */}
                  <div className="px-8 py-8 md:px-6 md:py-10 grid grid-cols-2 gap-2.5 content-center">
                    {[
                      { title: 'Flashcards', desc: 'Auto-generate study cards' },
                      { title: 'Trivia Game', desc: 'Rapid-fire timed questions' },
                      { title: 'Study Guide', desc: 'Terms, concepts, practice' },
                      { title: 'Explain It', desc: 'Plain-language breakdown' },
                      { title: 'Spelling', desc: 'Extract and practice words' },
                      { title: 'Full Quiz', desc: '5-question auto-graded' },
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
        )}

        {/* How it works */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                How it works
              </h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-8">
              {[
                { n: '1', title: 'Pick a tool', desc: 'Choose from quizzes, flashcards, study guides, math practice, spelling, or reading comprehension.', color: 'from-indigo-500 to-violet-500' },
                { n: '2', title: 'Enter a topic', desc: 'Type any subject or snap a photo of homework. Set the grade level and go.', color: 'from-violet-500 to-pink-500' },
                { n: '3', title: 'Practice and earn', desc: 'Complete activities to earn XP, collect badges, and build your streak. Track your progress.', color: 'from-pink-500 to-rose-500' },
              ].map((step) => (
                <div key={step.n} className="text-center space-y-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center text-xl mx-auto font-bold text-white shadow-sm`}>
                    {step.n}
                  </div>
                  <h3 className="font-serif text-lg text-oxford">{step.title}</h3>
                  <p className="text-sm text-charcoal-light leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Why parents love it
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {[
                { title: 'No prep work for you', desc: 'Just type a topic and the tool does the rest. No searching for worksheets or buying workbooks.' },
                { title: 'Grade-level appropriate', desc: 'Content adjusts to grades 1–8. Your child gets material that matches where they are.' },
                { title: 'Auto-graded', desc: 'Quizzes and practice sets are scored automatically. You see results immediately.' },
                { title: 'Works on any device', desc: 'Phone, tablet, laptop, or desktop. No app to install. Just open and start.' },
                { title: 'Photo upload support', desc: 'Snap a picture of homework, a textbook page, or worksheet — and get learning tools from it instantly.' },
                { title: 'Free during beta', desc: 'All learning tools are completely free right now. No credit card, no account required.' },
              ].map((item) => (
                <div key={item.title} className="bg-parchment rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
                  <h3 className="font-semibold text-oxford text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-charcoal-light leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Grades / subjects */}
        <section className="py-20 px-6">
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
                <span key={subject.name} className={`${subject.color} text-sm font-medium px-4 py-2 rounded-full border`}>
                  {subject.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-serif text-3xl text-oxford mb-10 text-center">
              Common questions
            </h2>

            <div className="space-y-6">
              {[
                { q: 'Is this really free?', a: 'Yes. All learning tools are free during beta. No credit card or account required.' },
                { q: 'What grades does it cover?', a: 'All tools are designed for grades 1–8. You select the grade level when generating content.' },
                { q: 'Do I need to create an account?', a: 'No. You can use any tool immediately without signing up. An account is only needed for classroom features and progress tracking.' },
                { q: 'How does the XP and badge system work?', a: 'Every activity you complete earns XP. As you accumulate XP, you level up and unlock badges. Practice daily to build your streak and earn bonus rewards.' },
                { q: 'What makes Scan Homework special?', a: 'No other platform lets you photograph homework and instantly turn it into 6 different learning activities. One photo becomes flashcards, trivia, study guides, explanations, spelling practice, or a full quiz.' },
              ].map((item) => (
                <div key={item.q} className="border-b border-gray-100 pb-6">
                  <h3 className="font-semibold text-oxford text-sm mb-2">{item.q}</h3>
                  <p className="text-sm text-charcoal-light leading-relaxed">{item.a}</p>
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
                <p className="font-semibold text-oxford text-sm">Also: Learning Stories</p>
                <p className="text-xs text-charcoal-light">
                  A personalized illustrated storybook with your child&apos;s topic woven in — plus a quiz at the end.
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
