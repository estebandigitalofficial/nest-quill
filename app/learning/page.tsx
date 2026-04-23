import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export const metadata: Metadata = {
  title: 'Learning Mode — Nest & Quill',
  description: 'Personalized learning tools for kids in grades 1–8. Learning Stories weave school subjects into illustrated adventures. Learning Mode generates quizzes from any topic instantly.',
}

const LEARNING_SUBJECTS = [
  { emoji: '➕', label: 'Math' },
  { emoji: '🔬', label: 'Science' },
  { emoji: '📖', label: 'Reading' },
  { emoji: '🏛️', label: 'History' },
  { emoji: '🌍', label: 'Social Studies' },
  { emoji: '✏️', label: 'Spelling' },
]

export default function LearningPage() {
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={
        <Link href="/" className="text-sm text-charcoal-light hover:text-oxford">← Back</Link>
      } />

      <div className="flex-1 overflow-y-auto">

        {/* Hero */}
        <section className="bg-oxford py-20 px-6 text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-900/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-brand-900/20 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-3xl mx-auto relative space-y-5">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
              Learning Mode
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl text-white leading-tight">
              Where learning meets{' '}
              <span className="text-indigo-300 italic">imagination.</span>
            </h1>
            <p className="text-lg max-w-xl mx-auto leading-relaxed" style={{ color: '#94a3b8' }}>
              Two ways to make school subjects click — a story that enchants, or a quiz that challenges. Pick your path.
            </p>
          </div>
        </section>

        {/* Two paths */}
        <section className="py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">

              {/* Path 1 — Learning Stories */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-gradient-to-br from-brand-50 to-brand-100/60 px-8 pt-10 pb-8">
                  <div className="text-4xl mb-4">📖</div>
                  <h2 className="font-serif text-2xl text-oxford mb-2">Learning Stories</h2>
                  <p className="text-sm text-charcoal leading-relaxed">
                    Your child becomes the hero of a fully illustrated storybook — and the story secretly teaches exactly what they&apos;re learning in school right now.
                  </p>
                </div>

                <div className="px-8 py-6 flex flex-col flex-1 gap-5">
                  <ul className="space-y-3">
                    {[
                      'Pick the subject, grade, and specific topic',
                      'AI writes a personalized illustrated story with the concept woven in naturally',
                      'A 5-question quiz at the end reinforces what they learned',
                      'Scores saved to their account to track progress',
                    ].map(item => (
                      <li key={item} className="flex gap-3 text-sm text-charcoal-light">
                        <span className="text-brand-500 shrink-0 mt-px font-bold">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap gap-1.5">
                    {LEARNING_SUBJECTS.map(s => (
                      <span key={s.label} className="bg-brand-50 text-brand-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        {s.emoji} {s.label}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto pt-2">
                    <Link
                      href="/create?mode=learning"
                      className="block text-center bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3.5 px-6 rounded-2xl transition-colors"
                    >
                      Create a Learning Story →
                    </Link>
                    <p className="text-center text-xs text-gray-400 mt-2">Ready in ~2 minutes · Free</p>
                  </div>
                </div>
              </div>

              {/* Path 2 — Learning Mode (Quiz Generator) */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/60 px-8 pt-10 pb-8">
                  <div className="text-4xl mb-4">🧠</div>
                  <h2 className="font-serif text-2xl text-oxford mb-2">Learning Mode</h2>
                  <p className="text-sm text-charcoal leading-relaxed">
                    No story needed. Type any topic, paste homework notes, or pick a subject and grade — and get an instant quiz to test what your child knows right now.
                  </p>
                </div>

                <div className="px-8 py-6 flex flex-col flex-1 gap-5">
                  <ul className="space-y-3">
                    {[
                      'Enter any topic or paste content from their homework',
                      'AI generates 5 targeted questions at exactly their grade level',
                      'Instant auto-graded results with explanations for every answer',
                      'Great for test prep, reviewing classwork, or just exploring a new subject',
                    ].map(item => (
                      <li key={item} className="flex gap-3 text-sm text-charcoal-light">
                        <span className="text-indigo-500 shrink-0 mt-px font-bold">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap gap-1.5">
                    {['Grades 1–8', 'Any topic', 'Instant', 'No signup needed'].map(tag => (
                      <span key={tag} className="bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto pt-2">
                    <Link
                      href="/learning/quiz"
                      className="block text-center bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 px-6 rounded-2xl transition-colors"
                    >
                      Generate a Quiz →
                    </Link>
                    <p className="text-center text-xs text-gray-400 mt-2">Ready in seconds · Free</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Coming soon tools */}
        <section className="pb-16 px-6">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-6">More coming to Learning Mode</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { emoji: '🃏', title: 'Flashcard Generator', desc: 'Turn any topic into a set of study cards' },
                { emoji: '🏫', title: 'Class Hub', desc: 'Teachers assign content, students complete from home' },
                { emoji: '🏆', title: 'Rewards & Streaks', desc: 'Earn coins and badges for consistent learning' },
              ].map(item => (
                <div key={item.title} className="bg-white border border-gray-100 rounded-2xl px-5 py-5 flex gap-4 items-start opacity-70">
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
