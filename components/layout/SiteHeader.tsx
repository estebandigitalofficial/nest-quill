import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import LearningDropdown from './LearningDropdown'
import MobileMenu from './MobileMenu'
import ThemeToggle from '@/components/ThemeToggle'

interface Props {
  right?: ReactNode
}

export default function SiteHeader({ right }: Props) {
  return (
    <header className="bg-parchment/95 dark:bg-parchment/95 backdrop-blur border-b border-parchment-dark dark:border-white/10 shrink-0 relative z-40">
      <div className="max-w-5xl mx-auto px-6 h-[58px] md:h-[60px] flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0 flex items-center">
          <Image
            src="https://nestandquill.b-cdn.net/nestandquill%20brand%20start-03.webp"
            alt="Nest & Quill"
            width={320}
            height={96}
            className="h-20 md:h-20 w-auto dark:brightness-0 dark:invert"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-5">
          <Link href="/create" className="text-sm text-charcoal-light dark:text-charcoal hover:text-oxford dark:hover:text-charcoal/70 transition-colors">Create a Story</Link>
          <LearningDropdown />
          <Link href="/classroom" className="text-sm text-charcoal-light dark:text-charcoal hover:text-oxford dark:hover:text-charcoal/70 transition-colors">Classroom</Link>
          <Link href="/pricing" className="text-sm text-charcoal-light dark:text-charcoal hover:text-oxford dark:hover:text-charcoal/70 transition-colors">Pricing</Link>
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-3">
          {right && <div className="flex items-center gap-4">{right}</div>}
          <div className="md:hidden">
            <ThemeToggle />
          </div>
          <MobileMenu />
        </div>
      </div>
    </header>
  )
}
