import Link from 'next/link'
import type { ReactNode } from 'react'

interface Props {
  right?: ReactNode
}

export default function SiteHeader({ right }: Props) {
  return (
    <header className="bg-parchment/95 backdrop-blur border-b border-parchment-dark shrink-0">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="font-serif text-xl font-semibold text-oxford shrink-0">
          Nest &amp; Quill
        </Link>
        <nav className="hidden sm:flex items-center gap-5 text-sm text-charcoal-light">
          <Link href="/learning" className="hover:text-oxford transition-colors">Learning</Link>
          <Link href="/classroom" className="hover:text-oxford transition-colors">Classroom</Link>
        </nav>
        {right && <div className="flex items-center gap-4">{right}</div>}
      </div>
    </header>
  )
}
