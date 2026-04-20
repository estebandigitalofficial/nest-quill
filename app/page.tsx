/**
 * Homepage placeholder.
 * Phase 3 will replace this with the full marketing landing page.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-brand-50 px-4">
      <div className="text-center max-w-xl">
        <div className="text-6xl mb-6">📖</div>
        <h1 className="text-4xl font-serif text-gray-900 mb-4">
          Nest &amp; Quill
        </h1>
        <p className="text-lg text-gray-600 mb-8 text-balance">
          Personalized AI-illustrated storybooks for children.
          Your story is being built.
        </p>
        <div className="inline-flex items-center gap-2 bg-brand-500 text-white px-6 py-3 rounded-full text-sm font-semibold">
          <span>Coming soon</span>
        </div>
      </div>
    </main>
  )
}
