'use client'

import Link from 'next/link'
import LogoutButton from '@/components/auth/LogoutButton'
import { useLanguage } from '@/lib/i18n/context'

export default function SiteHeaderAuthButtons({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { t } = useLanguage()

  return (
    <>
      {isLoggedIn ? (
        <>
          <Link href="/account"
            className="text-sm text-charcoal hover:text-oxford font-medium transition-colors hidden sm:block">
            {t.nav.myStories}
          </Link>
          <LogoutButton />
        </>
      ) : (
        <Link href="/login"
          className="text-sm text-charcoal hover:text-oxford font-medium transition-colors">
          {t.nav.signIn}
        </Link>
      )}
      <Link href="/create"
        className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors">
        {t.hero.cta}
      </Link>
    </>
  )
}
