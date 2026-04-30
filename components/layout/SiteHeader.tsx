import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import LearningDropdown from './LearningDropdown'
import MobileMenu from './MobileMenu'

interface Props {
  right?: ReactNode
}

export default function SiteHeader({ right }: Props) {
  return (
    <header className="bg-parchment/95 backdrop-blur border-b border-parchment-dark shrink-0 relative z-40">
      <div className="max-w-5xl mx-auto px-6 h-24 md:h-[52px] flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0 flex items-center">
          <Image
            src="https://nestandquill.b-cdn.net/nestandquill%20brand%20start-03.webp"
            alt="Nest & Quill"
            width={320}
            height={96}
            className="h-20 md:h-[50px] w-auto"
            priority
          />
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-5">
          <LearningDropdown />
          <Link href="/classroom" className="text-sm text-charcoal-light hover:text-oxford transition-colors">Classroom</Link>
          <Link href="/pricing" className="text-sm text-charcoal-light hover:text-oxford transition-colors">Pricing</Link>
        </nav>

        {/* Right slot + mobile hamburger — grouped so they stay together */}
        <div className="flex items-center gap-3">
          {right && <div className="flex items-center gap-4">{right}</div>}
          <MobileMenu />
        </div>
      </div>
    </header>
  )
}
