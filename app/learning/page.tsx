import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export const metadata: Metadata = {
  title: 'Learning Mode — Nest & Quill',
  description: 'AI-powered learning tools for kids in grades 1–8. Quizzes, flashcards, study guides, spelling practice, math problems, and reading comprehension — all free.',
}

const TOOLS = [
  {
    href: '/learning/scan-homework',
    emoji: '📸',
    title: 'Scan Homework',
    desc: 'Snap a photo of any worksheet or textbook page — instantly get flashcards, explanations, study guides, spelling practice, or trivia.',
    tag: 'New',
    color: 'rose',
  },
  {
    href: '/learning/quiz',
    emoji: '🧠',
    title: 'Quiz Generator',
    desc: 'Type any topic or snap a photo of homework — get a 5-question quiz instantly.',
    tag: 'Photo upload',
    color: 'indigo',
  },
  {
    href: '/learning/flashcards',
    emoji: '🃏',
    title: 'Flashcards',
    desc: 'Any topic or photo → 10 study cards. Tap to flip. Mark what you know.',
    tag: 'Photo upload',
    color: 'violet',
  },
  {
    href: '/learning/explain',
    emoji: '💡',
    title: 'Concept Explainer',
    desc: 'Ask about anything or upload a photo. Get a simple explanation, a real-world analogy, and something to try at home.',
    tag: 'Photo upload',
    color: 'amber',
  },
  {
    href: '/learning/study-guide',
    emoji: '📋',
    title: 'Study Guide',
    desc: 'Key terms, main concepts, memory tips, and practice questions — from any topic or photo.',
    tag: 'Photo upload',
    color: 'emerald',
  },
  {
    href: '/learning/spelling',
    emoji: '✏️',
    title: 'Spelling Practice',
    desc: 'Paste your word list from school. Practice one at a time, track your score.',
    tag: 'No AI needed',
    color: 'pink',
  },
  {
    href: '/learning/math',
    emoji: '🔢',
    title: 'Math Practice',
    desc: 'Pick a topic and grade — get 8 problems with step-by-step solutions.',
    tag: null,
    color: 'blue',
  },
  {
    href: '/learning/reading',
    emoji: '📖',
    title: 'Reading Comprehension',
    desc: 'Paste any passage and get 5 questions — literal and inferential.',
    tag: null,
    color: 'teal',
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

export default function LearningPage() {
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford">← Home</Link>} />

      <div className="flex-1 overflow-y-auto">

        {/* Hero */}
        <section className="bg-oxford py-16 px-6 text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-900/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-brand-900/20 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-2xl mx-auto relative space-y-4">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
              Learning Mode
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl text-white leading-tight">
              Every tool your child needs to{' '}
              <span className="text-indigo-300 italic">learn better.</span>
            </h1>
            <p className="text-base max-w-lg mx-auto" style={{ color: '#94a3b8' }}>
              8 free AI-powered tools for grades 1–8. No account required.
            </p>
          </div>
        </section>

        {/* Learning Stories callout */}
        <section className="px-6 pt-10 pb-2">
          <div className="max-w-4xl mx-auto">
            <div className="bg-brand-50 border border-brand-200 rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-3xl shrink-0">📖</span>
                <div>
                  <p className="font-semibold text-oxford text-sm">Also: Learning Stories</p>
                  <p className="text-xs text-charcoal-light">A personalized illustrated storybook with your child&apos;s topic woven in — plus a quiz at the end.</p>
                </div>
              </div>
              <Link href="/create?mode=learning"
                className="shrink-0 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors whitespace-nowrap">
                Create a Learning Story →
              </Link>
            </div>
          </div>
        </section>

        {/* Tools grid */}
        <section className="py-10 px-6">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Learning Tools</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TOOLS.map(tool => {
                const c = COLOR_MAP[tool.color]
                return (
                  <Link key={tool.href} href={tool.href}
                    className={`bg-white rounded-2xl border-2 border-gray-100 ${c.border} px-5 py-5 flex flex-col gap-3 transition-all hover:shadow-md group`}>
                    <div className={`w-12 h-12 ${c.bg} rounded-2xl flex items-center justify-center text-2xl`}>
                      {tool.emoji}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-oxford text-sm">{tool.title}</p>
                        {tool.tag && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${c.tag}`}>{tool.tag}</span>
                        )}
                      </div>
                      <p className="text-xs text-charcoal-light leading-relaxed">{tool.desc}</p>
                    </div>
                    <span className="text-xs font-semibold text-gray-400 group-hover:text-gray-600 transition-colors">Open →</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* Coming soon */}
        <section className="pb-16 px-6">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Coming Soon</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { emoji: '🏫', title: 'Class Hub', desc: 'Teachers assign content, students complete from home with a class code' },
                { emoji: '🏆', title: 'Rewards & Streaks', desc: 'Earn coins and badges for consistent daily learning' },
              ].map(item => (
                <div key={item.title} className="bg-white border border-gray-100 rounded-2xl px-5 py-5 flex gap-4 items-start opacity-60">
                  <span className="text-2xl shrink-0">{item.emoji}</span>
                  <div>
                    <p className="font-semibold text-sm text-oxford mb-1">{item.title}</p>
                    <p className="text-xs text-charcoal-light">{item.desc}</p>
                    <span className="inline-block mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded-full">Coming soon</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
      <SiteFooter />
    </div>
  )
}
