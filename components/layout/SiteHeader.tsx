import Link from 'next/link'
import type { ReactNode } from 'react'

interface Props {
  right?: ReactNode
}

export default function SiteHeader({ right }: Props) {
  return (
    <header className="bg-parchment/95 backdrop-blur border-b border-parchment-dark sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-serif text-xl font-semibold text-oxford">
          Nest &amp; Quill
        </Link>
        {right && <div className="flex items-center gap-4">{right}</div>}
      </div>
    </header>
  )
}
