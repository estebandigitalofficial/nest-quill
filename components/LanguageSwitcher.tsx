'use client'

import { useLanguage } from '@/lib/i18n/context'
import type { Lang } from '@/lib/i18n'

const OPTIONS: Lang[] = ['en', 'es']

/**
 * The site language selector: a small EN | ES pill that lives in the header
 * (desktop and mobile). Switching persists a cookie and refreshes server
 * components, so the whole page follows. No theme control lives here.
 */
export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useLanguage()
  return (
    <div
      role="group"
      aria-label={t.language.label}
      className={`flex items-center rounded-full p-0.5 gap-0.5 bg-parchment-dark border border-charcoal/10 ${className}`}
    >
      {OPTIONS.map(l => {
        const active = lang === l
        return (
          <button
            key={l}
            type="button"
            onClick={() => { if (!active) setLang(l) }}
            aria-pressed={active}
            aria-label={l === 'en' ? t.language.en : t.language.es}
            title={l === 'en' ? t.language.en : t.language.es}
            className={`min-w-[34px] h-7 px-2 rounded-full text-[11px] font-bold tracking-wide transition-all ${
              active ? 'bg-oxford text-parchment shadow-sm' : 'text-charcoal-light hover:text-charcoal'
            }`}
          >
            {l.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
