import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { listMyWriterProjects } from '@/lib/writer/projects'
import { PROJECT_TYPES, getProjectType } from '@/lib/writer/projectTypes'
import type { WriterProject } from '@/types/writer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Writer Studio — Nest & Quill',
  description:
    'Create books, manuals, guides, curriculum, and structured documents with Nest & Quill Writer Studio.',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In progress',
  complete: 'Complete',
  archived: 'Archived',
}

export default async function WriterStudioPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Logged-out visitors see the marketing/type-picker view only.
  const projects: WriterProject[] = user ? await listMyWriterProjects(user.id) : []

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
        {/* ── Hero ── */}
        <section className="bg-oxford py-20 px-6 text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-900/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-violet-900/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl mx-auto relative space-y-5">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
              Early access
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl text-white leading-tight text-balance">
              Writer Studio
            </h1>

            <p className="text-lg max-w-xl mx-auto leading-relaxed" style={{ color: '#94a3b8' }}>
              Create books, manuals, guides, curriculum, and structured documents.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/writer/new"
                className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-semibold px-7 py-3.5 rounded-full text-base transition-all active:scale-[0.98] shadow-lg shadow-indigo-900/40"
              >
                Create a project →
              </Link>
            </div>
          </div>
        </section>

        {/* ── My Projects (signed-in) ── */}
        {user && (
          <section className="py-16 px-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6 gap-4">
                <h2 className="font-serif text-2xl sm:text-3xl text-oxford">My Projects</h2>
                <Link
                  href="/writer/new"
                  className="shrink-0 bg-oxford hover:bg-oxford/90 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors whitespace-nowrap"
                >
                  + Create New Project
                </Link>
              </div>

              {projects.length === 0 ? (
                <div className="bg-white rounded-2xl border border-parchment-dark shadow-sm px-6 py-12 text-center">
                  <p className="text-3xl">🪶</p>
                  <h3 className="font-serif text-xl text-oxford mt-3">No projects yet</h3>
                  <p className="text-sm text-charcoal-light mt-2 max-w-sm mx-auto">
                    Start your first project — a book, manual, SOP, curriculum, and more.
                  </p>
                  <Link
                    href="/writer/new"
                    className="inline-block mt-5 bg-brand-500 hover:bg-brand-600 text-white font-semibold px-6 py-3 rounded-full text-sm transition-colors"
                  >
                    Create your first project →
                  </Link>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {projects.map((project) => {
                    const typeConfig = getProjectType(project.document_type)
                    return (
                      <Link
                        key={project.id}
                        href={`/writer/${project.id}`}
                        className="bg-white rounded-2xl border border-parchment-dark hover:border-oxford/30 shadow-sm hover:shadow-md px-5 py-5 flex items-center gap-4 transition-all hover:-translate-y-0.5 group"
                      >
                        <div
                          className={`w-12 h-12 ${typeConfig?.accent.iconBg ?? 'bg-oxford'} rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm`}
                        >
                          {typeConfig?.icon ?? 'P'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-oxford text-sm truncate group-hover:text-oxford-light transition-colors">
                            {project.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-charcoal-light">
                              {typeConfig?.name ?? project.document_type}
                            </span>
                            <span className="text-charcoal-light/40">·</span>
                            <span className="text-xs text-charcoal-light">
                              {STATUS_LABELS[project.status] ?? project.status}
                            </span>
                          </div>
                        </div>
                        <span className="text-charcoal-light group-hover:text-oxford transition-colors shrink-0">
                          →
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Document type cards (create entry point) ── */}
        <section id="types" className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                {user ? 'Start a new project' : 'Choose a document type'}
              </h2>
              <p className="text-charcoal-light max-w-md mx-auto">
                Pick the kind of project you want to build. Each type comes with a
                structure tailored to it.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PROJECT_TYPES.map((type) => (
                <Link
                  key={type.id}
                  href={`/writer/new?type=${type.id}`}
                  className={`relative bg-white rounded-2xl border-2 ${type.accent.border} ${type.accent.hoverBorder} px-5 py-5 flex flex-col gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 group`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 ${type.accent.iconBg} rounded-xl flex items-center justify-center text-white text-lg font-black shrink-0 shadow-sm`}
                    >
                      {type.icon}
                    </div>
                    <p className="font-bold text-oxford text-sm">{type.name}</p>
                  </div>
                  <p className="text-xs text-charcoal-light leading-relaxed">
                    {type.tagline}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {type.structure.map((block) => (
                      <span
                        key={block}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${type.accent.chipBg} ${type.accent.chipText}`}
                      >
                        {block}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-charcoal-light group-hover:text-oxford transition-colors mt-auto">
                    Start →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-oxford mb-3">
                How it works
              </h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  n: '1',
                  title: 'Choose a type',
                  desc: 'Pick from books, manuals, handbooks, SOPs, training guides, curriculum, or workbooks.',
                  color: 'from-indigo-500 to-violet-500',
                },
                {
                  n: '2',
                  title: 'Set up your project',
                  desc: 'Name your project and describe what you want. Each type gives you a structure to fill in.',
                  color: 'from-violet-500 to-pink-500',
                },
                {
                  n: '3',
                  title: 'Write and export',
                  desc: 'Draft section by section and export a finished document. Full writing tools are on the way.',
                  color: 'from-pink-500 to-rose-500',
                },
              ].map((step) => (
                <div key={step.n} className="text-center space-y-3">
                  <div
                    className={`w-12 h-12 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center text-xl mx-auto font-bold text-white shadow-sm`}
                  >
                    {step.n}
                  </div>
                  <h3 className="font-serif text-lg text-oxford">{step.title}</h3>
                  <p className="text-sm text-charcoal-light leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
