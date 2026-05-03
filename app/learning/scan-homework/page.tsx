import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import ScanHomeworkClient from './ScanHomeworkClient'
import { getSetting } from '@/lib/settings/appSettings'

export const metadata: Metadata = {
  title: 'Scan Homework — Nest & Quill',
  description: 'Take a photo of any homework or worksheet and instantly get flashcards, explanations, study guides, spelling practice, trivia, and more.',
}

export default async function ScanHomeworkPage() {
  const [enabled, triviaEnabled, thinkFirstEnabled, teachBackEnabled, nudgesEnabled, maxImageMb] = await Promise.all([
    getSetting('scan_homework_enabled', true),
    getSetting('trivia_enabled', true),
    getSetting('think_first_enabled', true),
    getSetting('teach_back_enabled', true),
    getSetting('learning_nudges_enabled', true),
    getSetting('max_image_upload_mb', 5),
  ])

  if (!enabled) {
    return (
      <div className="min-h-dvh bg-parchment flex flex-col">
        <SiteHeader right={<Link href="/learning" className="text-sm text-charcoal-light hover:text-oxford">← Learning</Link>} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-sm text-center space-y-4">
            <h1 className="font-serif text-2xl text-oxford">Scan Homework is unavailable</h1>
            <p className="text-sm text-charcoal-light leading-relaxed">
              This tool is temporarily disabled. Check back soon, or try one of the other learning tools.
            </p>
            <Link
              href="/learning"
              className="inline-block mt-2 bg-oxford hover:bg-oxford-light text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-colors"
            >
              ← Back to Learning
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/learning" className="text-sm text-charcoal-light hover:text-oxford">← Learning</Link>} />

      <main className="flex-1 overflow-y-auto">
        {/* Hero banner */}
        <section className="bg-gradient-to-br from-rose-500 via-pink-500 to-violet-600 py-10 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_70%)]" />
          <div className="max-w-lg mx-auto relative text-center space-y-3">
            <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block" />
              Only on Nest &amp; Quill
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl text-white leading-tight">
              Scan it. Study it. <span className="text-rose-200 italic">Master it.</span>
            </h1>

            <p className="text-sm text-white/80 leading-relaxed max-w-md mx-auto">
              Snap a photo of any worksheet, textbook, or notes — then choose
              from 6 different ways to study it. No other tool does this.
            </p>
          </div>
        </section>

        {/* Scanner tool */}
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          <ScanHomeworkClient triviaEnabled={triviaEnabled} thinkFirstEnabled={thinkFirstEnabled} teachBackEnabled={teachBackEnabled} nudgesEnabled={nudgesEnabled} maxImageMb={maxImageMb} />
        </div>

        {/* What you can do */}
        <section className="px-6 pb-10">
          <div className="max-w-lg mx-auto">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">One photo becomes</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { title: 'Flashcards', desc: 'Auto-generated study cards', color: 'bg-violet-50 border-violet-200 text-violet-700' },
                { title: 'Trivia Game', desc: 'Timed rapid-fire questions', color: 'bg-pink-50 border-pink-200 text-pink-700' },
                { title: 'Study Guide', desc: 'Terms, concepts, practice', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                { title: 'Explain It', desc: 'Simple breakdowns', color: 'bg-amber-50 border-amber-200 text-amber-700' },
                { title: 'Spelling', desc: 'Extract and practice words', color: 'bg-rose-50 border-rose-200 text-rose-700' },
                { title: 'Full Quiz', desc: '5-question auto-graded', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
              ].map((item) => (
                <div key={item.title} className={`${item.color} border rounded-xl px-3.5 py-3 space-y-0.5`}>
                  <p className="text-xs font-bold">{item.title}</p>
                  <p className="text-[10px] opacity-70">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        {/* Upsell — custom course */}
        <section className="px-6 pb-10">
          <div className="max-w-lg mx-auto">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-5 space-y-3">
              <div className="inline-block bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                Coming soon
              </div>
              <h3 className="font-serif text-lg text-oxford">
                Want a full month of coursework from this?
              </h3>
              <p className="text-xs text-charcoal-light leading-relaxed">
                Turn your scanned homework into a complete custom course — a
                month of structured quizzes, flashcards, study guides, and
                practice problems built around exactly what your child is learning.
              </p>
              <Link
                href="/homeschool"
                className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors"
              >
                Learn about homeschool curriculum →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
