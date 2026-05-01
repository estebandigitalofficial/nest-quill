'use client'

import Link from 'next/link'
import AnimatedQuill from '@/components/AnimatedQuill'
import { useLanguage } from '@/lib/i18n/context'

const SAMPLE_BOOKS = {
  en: [
    { title: "Xavior's Dinosaur Adventure", detail: 'Age 6 · Adventure · Watercolor' },
    { title: "Sofia Under the Sea",          detail: 'Age 4 · Magical · Cartoon' },
    { title: "Luca Saves the Stars",         detail: 'Age 8 · Brave · Digital Art' },
  ],
  es: [
    { title: 'La Aventura de Xavior con los Dinosaurios', detail: '6 años · Aventura · Acuarela' },
    { title: 'Sofía Bajo el Mar',                         detail: '4 años · Mágico · Caricatura' },
    { title: 'Luca Salva las Estrellas',                  detail: '8 años · Valiente · Arte Digital' },
  ],
}

export default function HomeHero() {
  const { lang, t } = useLanguage()
  const h = t.hero
  const books = SAMPLE_BOOKS[lang]

  return (
    <section className="bg-brand-50 pt-20 pb-24 px-6 text-center">
      <div className="max-w-3xl mx-auto space-y-7">
        <div className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1 rounded-full tracking-wide uppercase">
          {h.badge}
        </div>

        <div className="flex items-center justify-center gap-6">
          <h1 className="font-serif text-5xl sm:text-6xl text-oxford leading-tight text-balance">
            {h.headline1}{' '}
            <span className="text-brand-500 italic">{h.headline2}</span>
          </h1>
          <AnimatedQuill size={300} className="hidden sm:block shrink-0" />
        </div>

        <p className="text-lg text-charcoal max-w-xl mx-auto text-balance leading-relaxed">
          {h.sub}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/create"
            className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-7 py-3.5 rounded-full text-base transition-all active:scale-[0.98] shadow-md shadow-brand-200"
          >
            {h.cta}
          </Link>
          <Link
            href="#how-it-works"
            className="bg-white text-oxford font-semibold px-7 py-3.5 rounded-full text-base border border-parchment-dark hover:border-oxford/30 transition-colors"
          >
            {lang === 'es' ? 'Cómo funciona' : 'See how it works'}
          </Link>
        </div>

        <p className="text-xs text-gray-400 pt-1">
          {lang === 'es' ? 'Sin cuenta · Listo en menos de 2 minutos' : 'No account required · Ready in under 2 minutes'}
        </p>
      </div>

      <div className="max-w-2xl mx-auto mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {books.map((book) => (
          <div
            key={book.title}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-5 text-left space-y-2"
          >
            <p className="font-serif text-sm font-semibold text-gray-800 leading-snug">{book.title}</p>
            <p className="text-xs text-gray-400">{book.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
