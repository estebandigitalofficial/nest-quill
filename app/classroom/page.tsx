import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { getSetting } from '@/lib/settings/appSettings'
import ClassroomDisabled from './ClassroomDisabled'

export const metadata: Metadata = {
  title: 'Classroom — Nest & Quill',
  description:
    'A free teacher dashboard for classrooms. Create classes, assign learning tools, and track student progress in real time.',
}

export default async function ClassroomPage() {
  const classroomEnabled = await getSetting('classroom_enabled', true)
  if (!classroomEnabled) return <ClassroomDisabled />

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const role = user.user_metadata?.account_type ?? 'parent'
    const admin = createAdminClient()

    if (role === 'educator') {
      const { count } = await admin
        .from('classrooms')
        .select('id', { count: 'exact', head: true })
        .eq('educator_id', user.id)
        .eq('is_active', true)
      if ((count ?? 0) > 0) redirect('/classroom/educator')
    } else if (role === 'student') {
      const { data: memberships } = await admin
        .from('classroom_members')
        .select('classroom_id')
        .eq('student_id', user.id)
        .limit(200)
      const memberIds = (memberships ?? []).map(
        (m: { classroom_id: string }) => m.classroom_id
      )
      if (memberIds.length > 0) {
        const { count } = await admin
          .from('classrooms')
          .select('id', { count: 'exact', head: true })
          .in('id', memberIds)
          .eq('is_active', true)
        if ((count ?? 0) > 0) redirect('/classroom/student')
      }
    }
  }

  const isLoggedIn = !!user

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
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-brand-900/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl mx-auto relative space-y-5">
            <div className="inline-flex items-center gap-2 bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse inline-block" />
              Free for teachers
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl text-white leading-tight text-balance">
              Manage learning activities{' '}
              <span className="text-brand-300 italic">for your students.</span>
            </h1>

            <p className="text-lg max-w-xl mx-auto leading-relaxed" style={{ color: '#94a3b8' }}>
              Create a class, share a join code, and start assigning quizzes and
              learning tools in minutes. Track every student&apos;s progress and
              scores from one dashboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href={isLoggedIn ? '/classroom/activate?role=educator' : '/signup?role=educator'}
                className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-7 py-3.5 rounded-full text-base transition-all active:scale-[0.98] shadow-md shadow-brand-900/30"
              >
                Create a free classroom →
              </Link>

              <Link
                href="#how-it-works"
                className="bg-white/10 hover:bg-white/15 text-white font-semibold px-7 py-3.5 rounded-full text-base border border-white/20 transition-colors"
              >
                See how it works
              </Link>
            </div>

            <p className="text-xs pt-1" style={{ color: '#475569' }}>
              Free forever for educators · No credit card required
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Up and running in three steps
              </h2>
              <p className="text-charcoal-light max-w-md mx-auto">
                No complicated setup. No training required.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  n: '1',
                  title: 'Create a class',
                  desc: 'Sign up as an educator and get a unique 6-character join code to share with students.',
                },
                {
                  n: '2',
                  title: 'Assign learning tools',
                  desc: 'Pick any tool — quizzes, flashcards, study guides — set a topic and optional due date.',
                },
                {
                  n: '3',
                  title: 'Track progress',
                  desc: 'See who completed what, quiz scores, and flag students who need extra help.',
                },
              ].map((step) => (
                <div key={step.n} className="text-center space-y-3">
                  <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-2xl mx-auto font-bold text-brand-500">
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

        {/* Teacher dashboard features */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Everything you need in one dashboard
              </h2>
              <p className="text-charcoal-light max-w-lg mx-auto">
                A simple, focused dashboard built for teachers who want results
                without complexity.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {[
                {
                  title: 'Class join codes',
                  desc: 'Share a 6-character code. Students join instantly — no email invites or passwords needed.',
                },
                {
                  title: 'Assignment dashboard',
                  desc: 'Create assignments from any learning tool. Set topics, grade levels, and due dates.',
                },
                {
                  title: 'Student progress tracking',
                  desc: 'See completions, quiz scores, and time spent. Identify students who need help at a glance.',
                },
                {
                  title: 'Multiple classes',
                  desc: 'Manage as many classes as you need. Each with its own join code and student roster.',
                },
                {
                  title: 'Auto-graded quizzes',
                  desc: 'Quizzes are scored automatically. No manual grading required.',
                },
                {
                  title: 'Works on any device',
                  desc: 'Students can complete assignments from phone, tablet, or computer. Nothing to install.',
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

        {/* Student experience */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Simple for students too
              </h2>
              <p className="text-charcoal-light max-w-lg mx-auto">
                Students see their assignments, complete them at their own pace, and
                track their own progress.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  title: 'Join with a code',
                  desc: 'Enter the 6-character class code and start seeing assignments immediately.',
                },
                {
                  title: 'Complete at their pace',
                  desc: 'Students work through quizzes, flashcards, and practice on their own schedule.',
                },
                {
                  title: 'See their scores',
                  desc: 'Students can track what they have completed and how they scored.',
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

        {/* Use cases */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Works for any learning environment
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: 'Classrooms', desc: 'K–8 teachers assigning practice and tracking progress.' },
                { title: 'Tutoring', desc: 'Tutors assigning focused practice between sessions.' },
                { title: 'Homeschool', desc: 'Homeschool families organizing daily learning activities.' },
                { title: 'Enrichment', desc: 'After-school programs and learning pods.' },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-white rounded-2xl border border-gray-100 px-5 py-5 space-y-2"
                >
                  <h3 className="font-semibold text-oxford text-sm">{item.title}</h3>
                  <p className="text-xs text-charcoal-light leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why teachers like it */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Why teachers choose Nest &amp; Quill
              </h2>
            </div>

            <div className="space-y-4">
              {[
                'Free — no budget approval needed, no trial that expires.',
                'Simple — set up a class in under 2 minutes, not 2 hours.',
                'No student emails required — just share a join code.',
                'Auto-graded — spend time teaching, not grading worksheets.',
                'Works alongside any curriculum — not a replacement, a supplement.',
              ].map((item) => (
                <div
                  key={item}
                  className="flex gap-3 items-start bg-parchment rounded-xl px-5 py-4 border border-gray-100"
                >
                  <span className="text-brand-500 font-bold shrink-0 mt-px">✓</span>
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
                  q: 'Is Classroom really free for teachers?',
                  a: 'Yes. The classroom dashboard, student tracking, and all assignment features are free for educators. No trial, no credit card.',
                },
                {
                  q: 'How do students join?',
                  a: 'You share a 6-character join code. Students sign up with that code and they are added to your class. No email invites needed.',
                },
                {
                  q: 'What can I assign?',
                  a: 'Any learning tool — quizzes, flashcards, study guides, math practice, spelling, reading comprehension, and more. Set the topic and grade level.',
                },
                {
                  q: 'How many students can I have?',
                  a: 'Up to 30 students per class during beta. You can create multiple classes.',
                },
                {
                  q: 'Does it work for homeschool?',
                  a: 'Absolutely. Many homeschool parents use Classroom to organize and track their children\'s learning across subjects.',
                },
                {
                  q: 'Do I need to install anything?',
                  a: 'No. Everything runs in the browser. Works on any device — phones, tablets, laptops, and desktops.',
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

        {/* Role cards */}
        <section className="py-14 px-6 bg-white">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-serif text-2xl text-oxford">
                Ready to get started?
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <Link
                href={isLoggedIn ? '/classroom/activate?role=educator' : '/signup?role=educator'}
                className="bg-white rounded-2xl border-2 border-gray-100 hover:border-brand-300 px-7 py-8 flex flex-col gap-4 transition-all hover:shadow-md group"
              >
                <div>
                  <p className="font-semibold text-oxford text-lg mb-1">
                    I&apos;m an Educator
                  </p>
                  <p className="text-sm text-charcoal-light leading-relaxed">
                    Create a class, assign learning tools, and track every
                    student&apos;s progress and scores.
                  </p>
                </div>
                <span className="text-sm font-semibold text-brand-600 group-hover:text-brand-700 transition-colors">
                  Get started →
                </span>
              </Link>

              <Link
                href={isLoggedIn ? '/classroom/activate?role=student' : '/signup?role=student'}
                className="bg-white rounded-2xl border-2 border-gray-100 hover:border-indigo-300 px-7 py-8 flex flex-col gap-4 transition-all hover:shadow-md group"
              >
                <div>
                  <p className="font-semibold text-oxford text-lg mb-1">
                    I&apos;m a Student
                  </p>
                  <p className="text-sm text-charcoal-light leading-relaxed">
                    Enter your class join code to see your assignments and complete
                    them at your own pace.
                  </p>
                </div>
                <span className="text-sm font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                  Join a class →
                </span>
              </Link>
            </div>

            {!isLoggedIn && (
              <p className="text-center text-sm text-gray-400 mt-6">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="text-brand-600 font-medium hover:text-brand-700"
                >
                  Sign in
                </Link>
              </p>
            )}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="bg-oxford py-20 px-6 text-center">
          <div className="max-w-2xl mx-auto space-y-5">
            <h2 className="font-serif text-3xl sm:text-4xl text-white leading-tight">
              Start your classroom in under 2 minutes.
            </h2>
            <p className="text-slate-400 text-base">
              Free for teachers. No setup required. Just create a class and share
              the code.
            </p>
            <Link
              href={isLoggedIn ? '/classroom/activate?role=educator' : '/signup?role=educator'}
              className="inline-block bg-brand-500 hover:bg-brand-600 text-white font-semibold px-8 py-3.5 rounded-full text-base transition-colors shadow-lg"
            >
              Create a free classroom →
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
