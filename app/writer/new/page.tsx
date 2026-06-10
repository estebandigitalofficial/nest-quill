import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { PROJECT_TYPES, getProjectType } from '@/lib/writer/projectTypes'
import { createWriterProjectAction } from '@/app/writer/actions'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'New Project — Writer Studio — Nest & Quill',
  description: 'Start a new writing project in Nest & Quill Writer Studio.',
}

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type: typeParam } = await searchParams
  const selected = getProjectType(typeParam)

  return (
    <div className="min-h-dvh bg-parchment flex flex-col">
      <SiteHeader
        right={
          <Link href="/writer" className="text-sm text-charcoal-light hover:text-oxford">
            ← Writer Studio
          </Link>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Step indicator */}
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal-light mb-2">
            Create a project · Step 1 of 2
          </p>

          {!selected ? (
            // ── Step 1a: choose a document type ──
            <>
              <h1 className="font-serif text-3xl sm:text-4xl text-oxford mb-2">
                Choose a document type
              </h1>
              <p className="text-charcoal-light mb-10">
                What kind of project do you want to create?
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {PROJECT_TYPES.map((t) => (
                  <Link
                    key={t.id}
                    href={`/writer/new?type=${t.id}`}
                    className={`relative bg-white rounded-2xl border-2 ${t.accent.border} ${t.accent.hoverBorder} px-5 py-5 flex flex-col gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 group`}
                  >
                    {!t.available && (
                      <span className="absolute top-0 right-0 bg-charcoal-light/80 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl uppercase tracking-wide">
                        Coming soon
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 ${t.accent.iconBg} rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm`}
                      >
                        {t.icon}
                      </div>
                      <p className="font-bold text-oxford text-sm">{t.name}</p>
                    </div>
                    <p className="text-xs text-charcoal-light leading-relaxed">{t.tagline}</p>
                    <span className="text-xs font-bold text-charcoal-light group-hover:text-oxford transition-colors">
                      Select →
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            // ── Step 1b: type selected — foundation detail + coming-soon CTA ──
            <>
              <div className="flex items-start gap-4 mb-6">
                <div
                  className={`w-14 h-14 ${selected.accent.iconBg} rounded-2xl flex items-center justify-center text-white text-2xl font-black shrink-0 shadow-sm`}
                >
                  {selected.icon}
                </div>
                <div>
                  <h1 className="font-serif text-3xl sm:text-4xl text-oxford leading-tight">
                    New {selected.name}
                  </h1>
                  <p className="text-charcoal-light mt-1">{selected.description}</p>
                </div>
              </div>

              {/* What's inside — structural building blocks */}
              <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-6 py-5 mb-6">
                <p className="text-xs font-bold uppercase tracking-wide text-charcoal-light mb-3">
                  What&apos;s inside a {selected.name.toLowerCase()}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.structure.map((block) => (
                    <span
                      key={block}
                      className={`text-xs font-semibold px-3 py-1 rounded-full ${selected.accent.chipBg} ${selected.accent.chipText}`}
                    >
                      {block}
                    </span>
                  ))}
                </div>
              </div>

              {/* Create project */}
              <form
                action={createWriterProjectAction}
                className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-6 py-8"
              >
                <input type="hidden" name="documentType" value={selected.id} />

                <label
                  htmlFor="title"
                  className="block text-xs font-bold uppercase tracking-wide text-charcoal-light mb-2"
                >
                  Project title
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  defaultValue={`New ${selected.name}`}
                  maxLength={200}
                  required
                  className="w-full rounded-xl border border-parchment-dark bg-parchment/40 px-4 py-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-oxford/30"
                />

                <button
                  type="submit"
                  className="mt-5 inline-flex justify-center bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-semibold px-7 py-3 rounded-full text-sm transition-all active:scale-[0.98] shadow-lg shadow-indigo-900/30"
                >
                  Create project →
                </button>
                <p className="text-xs text-charcoal-light mt-3">
                  We&apos;ll create a draft and open its workspace. You can rename or delete it
                  later. The writing editor is on its way.
                </p>
              </form>

              <div className="mt-6">
                <Link
                  href="/writer/new"
                  className="text-sm text-charcoal-light hover:text-oxford font-medium"
                >
                  ← Choose a different type
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
