import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export const metadata: Metadata = {
  title: 'Classroom — Nest & Quill',
  description: 'Educators assign learning tools. Students complete assignments. Track progress in real time.',
}

export default async function ClassroomPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.user_metadata?.account_type ?? 'parent'
  if (role === 'educator') redirect('/classroom/educator')
  if (role === 'student') redirect('/classroom/student')

  // Logged-out, OR logged-in parent with no classroom role yet
  const isLoggedIn = !!user
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader right={<Link href="/" className="text-sm text-charcoal-light hover:text-oxford">← Home</Link>} />
      <div className="flex-1 overflow-y-auto">

        {/* Hero */}
        <section className="bg-oxford py-20 px-6 text-center relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-brand-900/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-2xl mx-auto relative space-y-4">
            <div className="inline-flex items-center gap-2 bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse inline-block" />
              Classroom
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl text-white leading-tight">
              Learning tools,{' '}
              <span className="text-brand-300 italic">organized for your class.</span>
            </h1>
            <p className="text-base max-w-lg mx-auto" style={{ color: '#94a3b8' }}>
              Educators assign quizzes, flashcards, and study guides. Students complete them from home. Everyone sees progress in real time.
            </p>
          </div>
        </section>

        {/* Role cards */}
        <section className="py-14 px-6">
          <div className="max-w-2xl mx-auto grid sm:grid-cols-2 gap-6">
            <Link href={isLoggedIn ? '/classroom/activate?role=educator' : '/signup?role=educator'}
              className="bg-white rounded-2xl border-2 border-gray-100 hover:border-brand-300 px-7 py-8 flex flex-col gap-4 transition-all hover:shadow-md group">
              <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-3xl">🏫</div>
              <div>
                <p className="font-semibold text-oxford text-lg mb-1">I&apos;m an Educator</p>
                <p className="text-sm text-charcoal-light leading-relaxed">Create a class, assign learning tools, and track every student&apos;s progress and scores.</p>
              </div>
              <span className="text-sm font-semibold text-brand-600 group-hover:text-brand-700 transition-colors">Get started →</span>
            </Link>

            <Link href={isLoggedIn ? '/classroom/activate?role=student' : '/signup?role=student'}
              className="bg-white rounded-2xl border-2 border-gray-100 hover:border-indigo-300 px-7 py-8 flex flex-col gap-4 transition-all hover:shadow-md group">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl">🎒</div>
              <div>
                <p className="font-semibold text-oxford text-lg mb-1">I&apos;m a Student</p>
                <p className="text-sm text-charcoal-light leading-relaxed">Enter your class join code to see your assignments and complete them at your own pace.</p>
              </div>
              <span className="text-sm font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors">Join a class →</span>
            </Link>
          </div>

          {!isLoggedIn && (
            <p className="text-center text-sm text-gray-400 mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700">Sign in</Link>
            </p>
          )}
        </section>

        {/* Free vs coming soon */}
        <section className="pb-4 px-6">
          <div className="max-w-2xl mx-auto">
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Free now</p>
                </div>
                {[
                  'Classes & student join codes',
                  'Assign quizzes, flashcards & more',
                  'Track completions & quiz scores',
                  'Up to 30 students per class',
                ].map(f => (
                  <p key={f} className="text-sm text-charcoal flex gap-2.5 items-start">
                    <span className="text-brand-500 font-bold shrink-0">✓</span>{f}
                  </p>
                ))}
              </div>
              <div className="bg-gray-50 rounded-2xl border border-gray-100 px-6 py-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Coming soon</p>
                </div>
                {[
                  'Bulk story creation for your class',
                  'Class story library',
                  'Progress reports & CSV export',
                  'School branding & custom cover',
                ].map(f => (
                  <p key={f} className="text-sm text-gray-400 flex gap-2.5 items-start">
                    <span className="shrink-0">○</span>{f}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-10 px-6">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 text-center">How it works</p>
            <div className="grid sm:grid-cols-3 gap-5">
              {[
                { n: '1', title: 'Create a class', desc: 'Educators get a unique 6-character join code to share with students.' },
                { n: '2', title: 'Assign tools', desc: 'Pick any learning tool — quiz, flashcards, study guide — and set a topic and due date.' },
                { n: '3', title: 'Track progress', desc: 'See who completed what, scores on quizzes, and flag students who need help.' },
              ].map(s => (
                <div key={s.n} className="bg-white rounded-2xl border border-gray-100 px-5 py-5 flex flex-col gap-3">
                  <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-sm font-bold flex items-center justify-center">{s.n}</span>
                  <p className="font-semibold text-oxford text-sm">{s.title}</p>
                  <p className="text-xs text-charcoal-light leading-relaxed">{s.desc}</p>
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
