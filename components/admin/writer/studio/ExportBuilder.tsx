'use client'

import { useState } from 'react'

type Format = 'epub' | 'pdf' | 'docx'

export default function ExportBuilder({ bookId }: { bookId: string }) {
  const [format, setFormat] = useState<Format>('epub')
  const [frontMatter, setFrontMatter] = useState(true)
  const [backMatter, setBackMatter] = useState(true)
  const [copyright, setCopyright] = useState(true)

  function buildUrl() {
    const params = new URLSearchParams()
    if (!frontMatter) params.set('frontMatter', 'false')
    if (!backMatter) params.set('backMatter', 'false')
    if (!copyright) params.set('copyright', 'false')
    const qs = params.toString()
    return `/api/admin/writer/books/${bookId}/export-${format}${qs ? `?${qs}` : ''}`
  }

  const formats: { id: Format; label: string; desc: string }[] = [
    { id: 'epub', label: 'ePub', desc: 'For Apple Books, Kindle, Kobo, and most ebook readers' },
    { id: 'pdf', label: 'PDF', desc: 'Print-ready or digital — preserves layout exactly' },
    { id: 'docx', label: 'Word (DOCX)', desc: 'For editing in Word, Google Docs, or further formatting' },
  ]

  const toggleClass = (on: boolean) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${on ? 'border-brand-500 bg-brand-500/10' : 'border-adm-border hover:border-adm-border'}`

  return (
    <div className="space-y-6">
      {/* Format */}
      <div>
        <p className="text-xs font-bold text-adm-muted uppercase tracking-widest mb-3">Format</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {formats.map(f => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`px-4 py-3 rounded-xl border text-left transition-colors space-y-0.5 ${format === f.id ? 'border-brand-500 bg-brand-500/10' : 'border-adm-border hover:border-adm-border'}`}
            >
              <p className={`text-sm font-semibold ${format === f.id ? 'text-brand-400' : 'text-adm-muted'}`}>{f.label}</p>
              <p className="text-xs text-adm-muted">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Include options */}
      <div>
        <p className="text-xs font-bold text-adm-muted uppercase tracking-widest mb-3">Include</p>
        <div className="space-y-2">
          <label className={toggleClass(frontMatter)}>
            <input type="checkbox" checked={frontMatter} onChange={e => setFrontMatter(e.target.checked)} className="accent-brand-500" />
            <div>
              <p className="text-sm text-adm-text font-medium">Front Matter</p>
              <p className="text-xs text-adm-muted">Dedication, Epigraph, Foreword, Preface, Acknowledgments</p>
            </div>
          </label>
          <label className={toggleClass(copyright)}>
            <input type="checkbox" checked={copyright} onChange={e => setCopyright(e.target.checked)} className="accent-brand-500" />
            <div>
              <p className="text-sm text-adm-text font-medium">Copyright Page</p>
              <p className="text-xs text-adm-muted">Generated from your copyright settings</p>
            </div>
          </label>
          <label className={toggleClass(backMatter)}>
            <input type="checkbox" checked={backMatter} onChange={e => setBackMatter(e.target.checked)} className="accent-brand-500" />
            <div>
              <p className="text-sm text-adm-text font-medium">Back Matter</p>
              <p className="text-xs text-adm-muted">Conclusion, Notes, About the Author, Also By</p>
            </div>
          </label>
        </div>
      </div>

      <a
        href={buildUrl()}
        className="block w-full text-center bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
      >
        Build & Download {formats.find(f => f.id === format)?.label} →
      </a>

      <p className="text-xs text-adm-subtle text-center">
        Only enabled front/back matter sections with content will be included.
      </p>
    </div>
  )
}
