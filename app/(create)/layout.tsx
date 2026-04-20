import type { ReactNode } from 'react'

export default function CreateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-50">
      <header className="px-6 py-5 border-b border-brand-100 bg-white">
        <a
          href="/"
          className="font-serif text-xl text-gray-900 hover:text-brand-600 transition-colors"
        >
          Nest &amp; Quill
        </a>
      </header>
      <main>{children}</main>
    </div>
  )
}
