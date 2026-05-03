import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { getSetting } from '@/lib/settings/appSettings'

export const metadata: Metadata = {
  title: 'Personalized Storybooks — Nest & Quill',
  description:
    'Create a personalized AI-illustrated storybook starring your child. Choose a theme, tell us about them, and get a unique book in minutes. The perfect gift.',
}

export default async function StorybooksPage() {
  const betaMode = (await getSetting('beta_mode_enabled', false)) as boolean

  return (
    <div className="min-h-dvh bg-parchment font-sans flex flex-col">
      <SiteHeader
        right={
          <Link
            href="/create"
            className="bg-brand-500 hover:bg-brand-600 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-colors whitespace-nowrap"
          >
            Create a story →
          </Link>
        }
      />

      <main className="flex-1 overflow-y-auto">
        {/* Hero */}
        <section className="bg-brand-50 pt-20 pb-24 px-6 text-center">
          <div className="max-w-3xl mx-auto space-y-7">
            {betaMode && (
              <div className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1 rounded-full tracking-wide uppercase">
                Free during beta
              </div>
            )}

            <h1 className="font-serif text-5xl sm:text-6xl text-oxford leading-tight text-balance">
              A personalized storybook{' '}
              <span className="text-brand-500 italic">starring your child.</span>
            </h1>

            <p className="text-lg text-charcoal max-w-xl mx-auto text-balance leading-relaxed">
              Their name. Their personality. Their interests. Woven into a
              beautifully illustrated story they will want to read again and again.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/create"
                className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-7 py-3.5 rounded-full text-base transition-all active:scale-[0.98] shadow-md shadow-brand-200"
              >
                Create your story free →
              </Link>
            </div>

            <p className="text-xs text-gray-400 pt-1">
              No account required · Ready in under 2 minutes
            </p>
          </div>
        </section>

        {/* Perfect for */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                The perfect gift for any occasion
              </h2>
              <p className="text-charcoal-light max-w-lg mx-auto">
                A one-of-a-kind storybook they will treasure. Made in minutes, kept
                forever.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: 'Birthdays', desc: 'A gift no one else will think of. Their name on every page.' },
                { title: 'Bedtime stories', desc: 'A new story every night — personalized to their world.' },
                { title: 'Holidays', desc: 'Christmas, Hanukkah, Easter — themed stories starring them.' },
                { title: 'Just because', desc: 'Surprise them with a story that shows you know them best.' },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-parchment rounded-2xl border border-gray-100 px-5 py-5 space-y-2"
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

        {/* How it works */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Three steps to their story
              </h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  n: '1',
                  title: 'Tell us about them',
                  desc: 'Their name, age, favorite things, personality traits — the more you share, the more magical the story.',
                },
                {
                  n: '2',
                  title: 'We write and illustrate',
                  desc: 'Our AI writes a unique story and creates custom illustrations in the art style you choose.',
                },
                {
                  n: '3',
                  title: 'Read, share, or print',
                  desc: 'Read online instantly, share with family, or download the full PDF to print at home.',
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

        {/* What makes it special */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                What makes it special
              </h2>
              <p className="text-charcoal-light max-w-lg mx-auto">
                Not a template. Not a name swap. A fully original story written
                around your child.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {[
                {
                  title: 'They are the main character',
                  desc: 'The story is built around their name, age, personality, and interests. Every page feels personal.',
                },
                {
                  title: '5 illustration styles',
                  desc: 'Choose watercolor, cartoon, classic storybook, pencil sketch, or digital art. Each book looks different.',
                },
                {
                  title: 'Up to 32 pages',
                  desc: 'Short bedtime story or a full illustrated adventure. You control the length.',
                },
                {
                  title: 'Dedication page',
                  desc: 'Add a personal message on the opening page. Perfect for gifts.',
                },
                {
                  title: 'Full PDF download',
                  desc: 'Download your storybook as a PDF. Print at home, at a print shop, or keep it digital.',
                },
                {
                  title: 'Ready in minutes',
                  desc: 'No waiting days for delivery. Your story is written, illustrated, and ready almost instantly.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-parchment rounded-2xl border border-gray-100 px-6 py-5"
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

        {/* Who it's for */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Made for the people who love them most
              </h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  title: 'Parents',
                  desc: 'Create bedtime stories, reward stories, or just-for-fun adventures starring your child.',
                },
                {
                  title: 'Grandparents',
                  desc: 'A meaningful, personal gift that shows how well you know your grandchild.',
                },
                {
                  title: 'Gift givers',
                  desc: 'Birthdays, holidays, new siblings — a gift that stands out from everything else.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 space-y-3"
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

        {/* Sample stories */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                Stories parents have created
              </h2>
              <p className="text-charcoal-light max-w-md mx-auto">
                Every book is unique. Here are a few examples.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { title: "Xavier's Dinosaur Adventure", detail: 'Age 6 · Adventure · Watercolor' },
                { title: 'Sofia Under the Sea', detail: 'Age 4 · Magical · Cartoon' },
                { title: 'Luca Saves the Stars', detail: 'Age 8 · Brave · Digital Art' },
                { title: 'Emma and the Secret Garden', detail: 'Age 5 · Nature · Classic' },
                { title: "Noah's Rocket Mission", detail: 'Age 7 · Space · Pencil Sketch' },
                { title: 'Mia Meets a Dragon', detail: 'Age 4 · Fantasy · Watercolor' },
              ].map((book) => (
                <div
                  key={book.title}
                  className="bg-parchment rounded-2xl border border-gray-100 px-4 py-5 text-left space-y-2"
                >
                  <p className="font-serif text-sm font-semibold text-gray-800 leading-snug">
                    {book.title}
                  </p>
                  <p className="text-xs text-gray-400">{book.detail}</p>
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
                  q: 'How long does it take?',
                  a: 'Most stories are ready in under 2 minutes. You can read it immediately online or download the PDF.',
                },
                {
                  q: 'Is the first story really free?',
                  a: 'Yes. Your first storybook is completely free with no account required. Paid plans unlock longer stories, more illustrations, and PDF downloads.',
                },
                {
                  q: 'Can I print it?',
                  a: 'Absolutely. Download the PDF and print at home or at any print shop. The file is print-ready.',
                },
                {
                  q: 'What ages is this for?',
                  a: 'Stories work best for ages 2–10, but you can create a book for any age. The story complexity adjusts based on the age you provide.',
                },
                {
                  q: 'Is each story truly unique?',
                  a: 'Yes. Every story is written from scratch based on the details you provide. No templates, no name swaps.',
                },
                {
                  q: 'Can I create more than one?',
                  a: 'Of course. Create as many stories as you want. Different themes, different characters, different art styles.',
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

        {/* Bottom CTA */}
        <section className="bg-brand-500 py-20 px-6 text-center">
          <div className="max-w-2xl mx-auto space-y-5">
            <h2 className="font-serif text-3xl sm:text-4xl text-white leading-tight">
              Their story is waiting to be written.
            </h2>

            <p className="text-brand-100 text-base">
              Create a personalized storybook in under 2 minutes — free, no account
              required.
            </p>

            <Link
              href="/create"
              className="inline-block bg-white text-brand-600 font-semibold px-8 py-3.5 rounded-full text-base hover:bg-brand-50 transition-colors shadow-lg"
            >
              Create your story free →
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
