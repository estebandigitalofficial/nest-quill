import Link from 'next/link'

export const metadata = { title: 'Page not found — Nest & Quill' }

export default function NotFound() {
  return (
    <div className="h-dvh bg-parchment flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-serif text-4xl text-oxford mb-3">Page not found</h1>
      <p className="text-charcoal-light text-sm max-w-xs leading-relaxed mb-8">
        Looks like this page got lost between chapters. Let&apos;s get you back to the story.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Go home
        </Link>
        <Link
          href="/create"
          className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Create a story
        </Link>
      </div>
    </div>
  )
}
