import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import LearningDropdown from './LearningDropdown'
import MobileMenu from './MobileMenu'
import UserControls from './UserControls'
import { getSetting } from '@/lib/settings/appSettings'

interface Props {
  right?: ReactNode
}

export default async function SiteHeader({ right }: Props) {
  // Note: we deliberately don't fetch the auth user here. SiteHeader is
  // imported into both server and client pages (e.g. /contact is a client
  // page) and pulling next/headers via the cookie-bound supabase server
  // client breaks those builds. UserControls fetches the user itself.
  const [classroomEnabled, headerLogoUrl] = await Promise.all([
    getSetting('classroom_enabled', true),
    getSetting('branding_header_logo_url', 'https://nestandquill.b-cdn.net/Nest%20and%20Quill%20Full%20Color.webp'),
  ])

  return (
    <header className="sticky top-0 bg-parchment/95 dark:bg-parchment/95 backdrop-blur border-b border-parchment-dark dark:border-white/10 shrink-0 z-40">
      <div className="max-w-5xl mx-auto px-6 h-[58px] md:h-[60px] flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0 flex items-center">
          <Image
            src={headerLogoUrl}
            alt="Nest & Quill"
            width={320}
            height={96}
            className="h-20 md:h-20 w-auto"
            priority
          />
        </Link>

        <nav className="hidden md:flex items-center gap-5">
          <Link href="/create" className="text-sm text-charcoal-light dark:text-charcoal hover:text-oxford transition-colors">Create a Story</Link>
          <LearningDropdown />
          {classroomEnabled && (
            <Link href="/classroom" className="text-sm text-charcoal-light dark:text-charcoal hover:text-oxford transition-colors">Classroom</Link>
          )}
          <Link href="/pricing" className="text-sm text-charcoal-light dark:text-charcoal hover:text-oxford transition-colors">Pricing</Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {right && <div className="flex items-center gap-3 sm:gap-4">{right}</div>}
          <UserControls />
          <MobileMenu classroomEnabled={classroomEnabled} />
        </div>
      </div>
    </header>
  )
}
