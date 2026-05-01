'use client'

import { useLanguage } from '@/lib/i18n/context'
import type { Lang } from '@/lib/i18n/translations'

const OPTIONS: Lang[] = ['en', 'es']

export default function LanguageToggle({ variant = 'site' }: { variant?: 'site' | 'admin' }) {
  const { lang, setLang } = useLanguage()
  const isAdmin = variant === 'admin'

  return (
    <div className={`flex items-center rounded-full p-0.5 gap-0.5 ${
      isAdmin
        ? 'bg-gray-800 border border-gray-700'
        : 'bg-parchment-dark dark:bg-gray-800 border border-charcoal/10 dark:border-gray-700'
    }`}>
      {OPTIONS.map(l => {
        const active = lang === l
        return (
          <button
            key={l}
            onClick={() => setLang(l)}
            title={l === 'en' ? 'English' : 'Español'}
            className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide transition-all ${
              active
                ? isAdmin
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-oxford text-parchment shadow-sm dark:bg-brand-500 dark:text-white'
                : isAdmin
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-charcoal-light hover:text-charcoal dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {l.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
