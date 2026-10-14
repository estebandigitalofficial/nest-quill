'use client'

/**
 * Modernized homepage — ported from design_handoff_nestandquill_modernized.
 * Homepage-scoped: all tokens live on .nqm-root, so nothing here affects the
 * rest of the site. Motion is a single passive scroll listener + Intersection
 * observer (no framer-motion); icons are inline SVG (no lucide dependency).
 * Copy is final per the handoff; EN/ES wired to the site's LanguageProvider.
 *
 * Book covers are curated demo artwork exported from the owner's own test
 * stories (never customer books), stored as 3:4 WebP files in
 * public/brand/covers and referenced from BOOK_LAYOUT. The homepage never
 * reads Supabase Storage.
 */

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'
import type { Lang } from '@/lib/i18n'
import { PLAN_CONFIG, WIZARD_PLANS } from '@/lib/plans/config'

// ── Inline Lucide icon paths (stroke, 24×24) ────────────────────────────────
const ICONS: Record<string, string> = {
  pen: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
}

function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? '' }} />
  )
}

// ── Copy (final per handoff) ────────────────────────────────────────────────
// Plan names, prices, features and beta/paused lines are NOT here: they come
// from PLAN_CONFIG and the dictionary (t.pricing.*, t.home.*) so the homepage
// matches /pricing and /create.
type Copy = {
  nav: { create: string; pricing: string; signin: string; account: string; cta: string }
  hero: { l1: string; l2: string; body: string; sub: string; primary: string; secondary: string; micro: string }
  books: { title: string; meta: string }[]
  how: { title: string; sub: string; step: (n: number) => string; steps: { title: string; copy: string }[] }
  get: { title: string; sub: string; features: { icon: string; title: string; copy: string }[] }
  cta: { l1: string; l2: string; sub: string; button: string }
  footer: { tagline: string; colA: string[]; colB: string[]; colC: string[]; copyright: string }
}

const COPY: Record<Lang, Copy> = {
  en: {
    nav: { create: 'Create a Story', pricing: 'Pricing', signin: 'Sign in', account: 'My account', cta: 'Create a story →' },
    hero: {
      l1: 'A storybook', l2: 'made just for them.',
      body: "Personalized AI storybooks starring your child. Pick a theme, tell us about them, and we'll write a unique book in minutes.",
      sub: 'Every book is fully illustrated in the style you choose.',
      primary: 'Create your story free →', secondary: 'See how it works',
      micro: 'No account required · Ready in minutes',
    },
    books: [
      { title: 'The Day Theo Stopped Time', meta: 'Age 8 · Winter mystery · Cartoon' },
      { title: "The Lantern's Last Light", meta: 'Age 8 · Seaside mystery · Classic Storybook' },
      { title: 'Pip and the Lost Shell', meta: 'Age 5 · Beach adventure · Watercolor' },
    ],
    how: {
      title: 'A book in three steps', sub: 'From blank page to personalized storybook in minutes.',
      step: (n) => `Step ${n}`,
      steps: [
        { title: 'Tell us about your child', copy: 'Their name, age, what they love — the more you share, the more personal the story feels.' },
        { title: 'We write & illustrate', copy: 'Our AI writes a unique story and creates illustrations styled exactly how you want.' },
        { title: 'Read & share', copy: 'Your finished storybook is ready to read online and share instantly. Download the full PDF on paid plans.' },
      ],
    },
    get: {
      title: 'What you get', sub: 'A beautifully structured storybook, page by page.',
      features: [
        { icon: 'palette', title: '5 illustration styles', copy: 'Choose from watercolor, cartoon, classic storybook, pencil sketch, or digital art.' },
        { icon: 'book', title: 'Up to 32 pages', copy: 'Short bedtime story or a full adventure — you control the length.' },
        { icon: 'heart', title: 'Dedication page', copy: 'Add a personal message printed on the opening page of the book.' },
        { icon: 'download', title: 'Full PDF download', copy: 'Download and keep your story forever. Print at home or at any print shop. Included on all paid plans.' },
        { icon: 'sparkles', title: 'Truly personalized', copy: "The story is written around your child's name, age, personality, and interests." },
        { icon: 'zap', title: 'Ready in minutes', copy: 'No waiting days. Your story is generated and ready to read almost instantly.' },
      ],
    },
    cta: { l1: 'Every child deserves a story', l2: 'made for them.', sub: 'Create your first storybook free — no account required.', button: 'Create a story now →' },
    footer: {
      tagline: 'A product of Bright Tale Books',
      colA: ['Home', 'Create', 'Account'], colB: ['Create a Story', 'Pricing', 'Contact'], colC: ['Privacy', 'Terms'],
      copyright: '© 2026 Bright Tale Books',
    },
  },
  es: {
    nav: { create: 'Crear un cuento', pricing: 'Precios', signin: 'Iniciar sesión', account: 'Mi cuenta', cta: 'Crea un cuento →' },
    hero: {
      l1: 'Un cuento', l2: 'hecho solo para ellos.',
      body: 'Cuentos personalizados con IA protagonizados por tu hijo. Elige un tema, cuéntanos sobre él y escribiremos un libro único en minutos.',
      sub: 'Cada libro está completamente ilustrado en el estilo que elijas.',
      primary: 'Crea tu cuento gratis →', secondary: 'Cómo funciona',
      micro: 'Sin cuenta · Listo en minutos',
    },
    books: [
      { title: 'El día que Theo detuvo el tiempo', meta: 'Edad 8 · Misterio de invierno · Caricatura' },
      { title: 'La última luz del farol', meta: 'Edad 8 · Misterio junto al mar · Cuento clásico' },
      { title: 'Pip y la caracola perdida', meta: 'Edad 5 · Aventura en la playa · Acuarela' },
    ],
    how: {
      title: 'Un libro en tres pasos', sub: 'De la página en blanco a un cuento personalizado en minutos.',
      step: (n) => `Paso ${n}`,
      steps: [
        { title: 'Cuéntanos sobre tu hijo', copy: 'Su nombre, edad y lo que le encanta: cuanto más compartas, más personal será el cuento.' },
        { title: 'Escribimos e ilustramos', copy: 'Nuestra IA escribe un cuento único y crea ilustraciones con el estilo que quieras.' },
        { title: 'Léelo y compártelo', copy: 'Tu cuento estará listo para leer en línea y compartir al instante. Descarga el PDF completo en los planes de pago.' },
      ],
    },
    get: {
      title: 'Lo que incluye', sub: 'Un cuento bellamente estructurado, página a página.',
      features: [
        { icon: 'palette', title: '5 estilos de ilustración', copy: 'Elige entre acuarela, dibujos animados, cuento clásico, lápiz o arte digital.' },
        { icon: 'book', title: 'Hasta 32 páginas', copy: 'Un cuento corto para dormir o una aventura completa: tú decides la extensión.' },
        { icon: 'heart', title: 'Página de dedicatoria', copy: 'Añade un mensaje personal impreso en la primera página del libro.' },
        { icon: 'download', title: 'Descarga en PDF', copy: 'Descarga y guarda tu cuento para siempre. Imprímelo en casa o en cualquier imprenta. Incluido en todos los planes de pago.' },
        { icon: 'sparkles', title: 'Totalmente personalizado', copy: 'El cuento se escribe en torno al nombre, la edad, la personalidad y los intereses de tu hijo.' },
        { icon: 'zap', title: 'Listo en minutos', copy: 'Sin esperar días. Tu cuento se genera y está listo para leer casi al instante.' },
      ],
    },
    cta: { l1: 'Todo niño merece un cuento', l2: 'hecho para él.', sub: 'Crea tu primer cuento gratis, sin necesidad de cuenta.', button: 'Crea un cuento ahora →' },
    footer: {
      tagline: 'Un producto de Bright Tale Books',
      colA: ['Inicio', 'Crear', 'Cuenta'], colB: ['Crear un cuento', 'Precios', 'Contacto'], colC: ['Privacidad', 'Términos'],
      copyright: '© 2026 Bright Tale Books',
    },
  },
}

// Layout is language-independent; `cover` pairs each slot with its artwork
// (600x800 WebP, 3:4). Order matches COPY[lang].books.
const BOOK_LAYOUT = [
  { left: '0%', top: '60px', rot: -6, z: 1, dur: 6, delay: '0s', cover: '/brand/covers/snow-village.webp' },
  { left: '22%', top: '0px', rot: 2, z: 3, dur: 7, delay: '-1.7s', cover: '/brand/covers/night-market.webp' },
  { left: '44%', top: '90px', rot: 7, z: 2, dur: 8, delay: '-3.4s', cover: '/brand/covers/tide-pool.webp' },
]
const FOOTER_HREFS = {
  colA: ['/', '/create', '/account'],
  colB: ['/create', '#pricing', '/contact'],
  colC: ['/privacy', '/terms'],
}

interface Props {
  /** app_settings.beta_mode_enabled — messaging only; enforcement never reads it. */
  betaMode?: boolean
  /** app_settings.image_generation_enabled === false. Independent of betaMode. */
  imagesPaused?: boolean
}

export default function ModernHome({ betaMode = false, imagesPaused = false }: Props) {
  const { lang, t: dict } = useLanguage()
  const t = COPY[lang] ?? COPY.en
  const card = dict.pricing.card
  const rootRef = useRef<HTMLDivElement>(null)
  const [heroShift, setHeroShift] = useState(0)
  const [howProgress, setHowProgress] = useState(0)
  const [quillRot, setQuillRot] = useState(0)
  // Touch-only tap-to-front for the hero stack. Index into BOOK_LAYOUT; the
  // centre card (slot 1) starts on top. Only consulted by the (hover:none)
  // CSS rule, so pointer-hover devices keep PR #12's hover-to-front and a
  // mouse click never sticks a card on top.
  const [activeBook, setActiveBook] = useState(1)
  const tapBook = (i: number) => {
    if (window.matchMedia('(hover:hover)').matches) return
    setActiveBook(i)
  }

  // Scroll-reveal: visible on first paint, hidden + observed only after mount
  // (so no-JS / reduced-motion users always see content).
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const show = (el: HTMLElement) => { el.style.opacity = '1'; el.style.transform = 'none' }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { show(e.target as HTMLElement); io.unobserve(e.target) } })
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    root.querySelectorAll<HTMLElement>('.nqm-reveal').forEach((el) => {
      const d = (Number(el.dataset.i) || 0) * 90
      el.style.opacity = '0'
      el.style.transform = 'translateY(32px)'
      el.style.transition = `opacity .8s ease ${d}ms, transform .9s cubic-bezier(.2,.8,.2,1) ${d}ms`
      io.observe(el)
    })
    // Anything already in view on load reveals immediately.
    const kick = () => root.querySelectorAll<HTMLElement>('.nqm-reveal').forEach((el) => {
      if (el.style.opacity === '1') return
      const r = el.getBoundingClientRect()
      if (r.top < window.innerHeight * 0.92 && r.bottom > 0) show(el)
    })
    requestAnimationFrame(kick)
    const safety = setTimeout(kick, 1500)
    return () => { io.disconnect(); clearTimeout(safety) }
  }, [])

  // Scroll-linked values: nav shadow, hero parallax, progress bar, feather spin.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY
        if (!reduce) setHeroShift(Math.max(y * -0.06, -40))
        const how = document.getElementById('how-it-works')
        if (how) {
          const r = how.getBoundingClientRect()
          setHowProgress(Math.max(0, Math.min(100, ((window.innerHeight * 0.8 - r.top) / (r.height * 0.6)) * 100)))
        }
        const cr = document.getElementById('create')
        if (cr && !reduce) {
          const q = (window.innerHeight - cr.getBoundingClientRect().top) * 0.05 - 20
          setQuillRot(Math.max(-20, Math.min(20, q)))
        }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [])

  return (
    <div ref={rootRef} className="nqm-root">
      <style>{NQM_CSS}</style>

      {/* Nav is the shared SiteHeader (rendered by the page), so the header is
          identical on every route. */}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div id="top" className="nqm-wrap">
        <section className="nqm-hero">
          <div>
            {betaMode && <span className="nqm-reveal nqm-badge nqm-hero-badge">{dict.home.hero.badge}</span>}
            <h1 className="nqm-h1">
              <span className="nqm-reveal" data-i="0" style={{ display: 'block' }}>{t.hero.l1}</span>
              <span className="nqm-reveal" data-i="1" style={{ display: 'block' }}>
                {t.hero.l2.split(' ').slice(0, -2).join(' ')}{' '}
                <em className="nqm-accent-em">{t.hero.l2.split(' ').slice(-2).join(' ')}</em>
              </span>
            </h1>
            <p className="nqm-reveal nqm-hero-body" data-i="2">{t.hero.body}</p>
            <p className="nqm-reveal nqm-hero-sub" data-i="3">
              {imagesPaused ? dict.home.hero.imagesPaused : betaMode ? dict.home.hero.betaLine : t.hero.sub}
            </p>
            <div className="nqm-reveal nqm-hero-cta" data-i="4">
              <Link href="/create" className="nqm-btn nqm-btn-primary nqm-btn-lift nqm-btn-lg">{t.hero.primary}</Link>
              <Link href="#how-it-works" className="nqm-btn nqm-btn-ghost nqm-btn-lift nqm-btn-lg">{t.hero.secondary}</Link>
            </div>
            <p className="nqm-reveal nqm-micro" data-i="5"><span className="nqm-dot" />{t.hero.micro}</p>
          </div>

          <div className="nqm-stage" style={{ transform: `translateY(${heroShift}px)` }}>
            {t.books.map((b, i) => {
              const L = BOOK_LAYOUT[i]
              return (
                <div key={b.title} className="nqm-reveal nqm-book" data-i={i + 1}
                  data-active={activeBook === i ? '' : undefined}
                  onClick={() => tapBook(i)}
                  style={{ left: L.left, top: L.top, ['--z' as string]: L.z }}>
                  <div className="nqm-book-float" style={{ ['--rot' as string]: `${L.rot}deg`, animationDuration: `${L.dur}s`, animationDelay: L.delay }}>
                    <div className="nqm-book-card">
                      <CoverSlot title={b.title} src={L.cover} priority={i === 1} />
                      <div className="nqm-book-cap">
                        <span className="nqm-book-title">{b.title}</span>
                        <span className="nqm-book-meta">{b.meta}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section id="how-it-works" className="nqm-band">
        <div className="nqm-wrap nqm-band-pad">
          <h2 className="nqm-reveal nqm-h2">{t.how.title}</h2>
          <p className="nqm-reveal nqm-lead" data-i="1">{t.how.sub}</p>
          <div className="nqm-progress"><div className="nqm-progress-fill" style={{ width: `${howProgress}%` }} /></div>
          <div className="nqm-steps">
            {t.how.steps.map((st, i) => (
              <div key={st.title} className="nqm-reveal nqm-card nqm-step nqm-lift" data-i={i}>
                <div className="nqm-step-head">
                  <span className="nqm-step-num">{i + 1}</span>
                  <span className="nqm-eyebrow">{t.how.step(i + 1)}</span>
                </div>
                <h3 className="nqm-h3">{st.title}</h3>
                <p className="nqm-body">{st.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What you get ──────────────────────────────────────────────────── */}
      <div className="nqm-wrap">
        <section className="nqm-sec">
          <h2 className="nqm-reveal nqm-h2">{t.get.title}</h2>
          <p className="nqm-reveal nqm-lead" data-i="1">{t.get.sub}</p>
          <div className="nqm-features">
            {t.get.features.map((f, i) => (
              <div key={f.title} className="nqm-reveal nqm-card nqm-feature nqm-lift" data-i={i % 3}>
                <span className="nqm-ficon"><Icon name={f.icon} size={24} /></span>
                <h3 className="nqm-h3 nqm-h3-sm">{f.title}</h3>
                <p className="nqm-body">{f.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <hr className="nqm-rule" />

        {/* ── Pricing ─────────────────────────────────────────────────────── */}
        <section id="pricing" className="nqm-sec">
          <h2 className="nqm-reveal nqm-h2">{dict.home.pricing.title}</h2>
          <p className="nqm-reveal nqm-lead nqm-lead-wide" data-i="1">{betaMode ? dict.home.pricing.betaSub : dict.home.pricing.steadySub}</p>
          <div className="nqm-plans">
            {WIZARD_PLANS.map((tier, i) => {
              // Same price rules as PlanCard: beta shows every plan as free.
              const plan = PLAN_CONFIG[tier]
              const copy = dict.pricing.plans[tier]
              const free = betaMode || plan.pricingType === 'free'
              const unit = free ? '' : (plan.pricingType === 'one_time' ? card.once : card.perMonth).trim()
              return (
                <div key={tier} className={`nqm-reveal nqm-plan nqm-lift${plan.isPopular ? ' is-popular' : ''}`} data-i={i}>
                  <div className="nqm-plan-head">
                    <span className="nqm-plan-name">{copy.name}</span>
                    {plan.isPopular && <span className="nqm-badge">{card.popular}</span>}
                  </div>
                  <div className="nqm-plan-price"><span className="nqm-price">{free ? card.free : `$${plan.priceMonthly}`}</span>{unit && <span className="nqm-unit">{unit}</span>}</div>
                  <div className="nqm-plan-items">
                    {copy.features.map((li) => (
                      <span key={li} className="nqm-plan-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="nqm-check"><path d="M20 6 9 17l-5-5" /></svg>
                        {li}
                      </span>
                    ))}
                  </div>
                  <Link href="/create" className={`nqm-btn nqm-plan-btn ${plan.isPopular ? 'nqm-btn-primary' : 'nqm-btn-ghost'}`}>{betaMode ? copy.ctaBeta : copy.cta}</Link>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* ── Closing CTA ───────────────────────────────────────────────────── */}
      <section id="create" className="nqm-cta">
        <div className="nqm-wrap nqm-cta-grid">
          <div>
            <h2 className="nqm-h2 nqm-cta-h">
              <span className="nqm-reveal" style={{ display: 'block' }}>{t.cta.l1}</span>
              <span className="nqm-reveal nqm-accent-400" data-i="1" style={{ display: 'block', fontStyle: 'italic' }}>{t.cta.l2}</span>
            </h2>
            <p className="nqm-reveal nqm-cta-sub" data-i="2">{t.cta.sub}</p>
            <div className="nqm-reveal" data-i="3" style={{ marginTop: 32, display: 'flex' }}>
              <Link href="/create" className="nqm-btn nqm-btn-primary nqm-btn-lg nqm-cta-btn">{t.cta.button}</Link>
            </div>
          </div>
          <Image src="/brand/fav.webp" alt="" width={220} height={220} className="nqm-feather" style={{ transform: `rotate(${quillRot}deg)` }} />
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="nqm-wrap nqm-footer">
        <div className="nqm-foot-brand">
          <span className="nqm-foot-logo"><Image src="/brand/fav.webp" alt="" width={28} height={28} />Nest &amp; Quill</span>
          <span className="nqm-muted">{t.footer.tagline}</span>
        </div>
        <div className="nqm-foot-col">{t.footer.colA.map((l, i) => <Link key={l} href={FOOTER_HREFS.colA[i]}>{l}</Link>)}</div>
        <div className="nqm-foot-col">{t.footer.colB.map((l, i) => <Link key={l} href={FOOTER_HREFS.colB[i]}>{l}</Link>)}</div>
        <div className="nqm-foot-col nqm-foot-legal">{t.footer.colC.map((l, i) => <Link key={l} href={FOOTER_HREFS.colC[i]}>{l}</Link>)}</div>
        <span className="nqm-copyright">{t.footer.copyright}</span>
      </footer>
    </div>
  )
}

// Curated 3:4 cover artwork. The gradient stays underneath as the paint
// while the image loads; the card is at most 270px wide, so `sizes` keeps
// next/image from serving the full 600px file to phones.
function CoverSlot({ title, src, priority }: { title: string; src: string; priority?: boolean }) {
  return (
    <div className="nqm-cover">
      <Image
        src={src}
        alt={`${title} cover`}
        fill
        sizes="(max-width: 768px) 56vw, 270px"
        priority={priority}
        style={{ objectFit: 'cover' }}
      />
    </div>
  )
}

const NQM_CSS = `
.nqm-root{
  --bg:#fbf9f4;--surface:#ffffff;--text:#0f2140;--divider:rgba(15,33,64,.4);
  --accent:#c59a00;--accent-100:#f8f0d6;--accent-200:#efdfa8;--accent-300:#e3c96f;
  --accent-400:#d4b030;--accent-600:#a88300;--accent-700:#866800;--accent-800:#634d00;
  --n100:#eef0f4;--n200:#dde1e8;--n300:#c3c9d4;--n400:#9aa3b3;--n500:#707b8f;--n600:#556075;--n700:#3f4a5e;--n800:#2a3448;
  --sh-sm:0 1px 2px rgba(15,33,64,.08), 0 1px 3px rgba(15,33,64,.06);
  --sh-md:0 8px 20px rgba(15,33,64,.10), 0 2px 4px rgba(15,33,64,.06);
  --sh-lg:0 24px 48px rgba(15,33,64,.18), 0 6px 12px rgba(15,33,64,.08);
  --r-sm:8px;--r-md:12px;--r-lg:16px;
  --fh:var(--font-heading),Georgia,serif;--fb:var(--font-body),system-ui,sans-serif;
  background:var(--bg);color:var(--text);font-family:var(--fb);min-height:100vh;scroll-behavior:smooth;
}
.nqm-root *{box-sizing:border-box}
.nqm-root a{color:inherit;text-decoration:none}
.nqm-root h1,.nqm-root h2,.nqm-root h3{font-family:var(--fh);font-weight:700;margin:0}
.nqm-root :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.nqm-wrap{max-width:1200px;margin:0 auto;padding:0 clamp(20px,5vw,72px)}

/* nav */
.nqm-nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:6px;flex-wrap:wrap;
  padding:12px clamp(20px,5vw,72px);background:var(--bg);border-bottom:2px solid var(--divider);
  transition:box-shadow .3s ease,border-color .3s ease}
.nqm-brand{font-family:var(--fh);font-weight:700;font-size:22px;margin-right:auto;display:flex;align-items:center;gap:8px}
.nqm-navlinks{display:flex;align-items:center;gap:2px}
.nqm-navlink{position:relative;display:grid;place-items:center;padding:10px 14px;font-size:14px;font-weight:600}
.nqm-navlink .nqm-label{display:block;transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .3s ease}
.nqm-navlink .nqm-icon{position:absolute;inset:0;display:grid;place-items:center;color:var(--accent-600);
  transform:rotate(240deg) scale(0);opacity:0;transition:transform .55s cubic-bezier(.2,1.4,.3,1),opacity .3s ease}
.nqm-navlink:hover .nqm-label,.nqm-navlink:focus-visible .nqm-label{transform:rotate(-120deg) scale(.3);opacity:0}
.nqm-navlink:hover .nqm-icon,.nqm-navlink:focus-visible .nqm-icon{transform:none;opacity:1}
.nqm-langs{display:flex;border:2px solid var(--divider);margin:0 8px;border-radius:var(--r-sm);overflow:hidden}
.nqm-lang{font-family:var(--fb);font-weight:600;font-size:12px;padding:6px 10px;border:0;cursor:pointer;
  background:transparent;color:var(--text);transition:background .2s ease,color .2s ease}
.nqm-lang.is-active{background:var(--text);color:var(--bg)}

/* buttons */
.nqm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;
  font-family:var(--fb);font-weight:600;font-size:14px;line-height:1.2;border:0;border-radius:var(--r-sm);padding:10px 16px}
.nqm-btn-lg{font-size:15px;padding:14px 22px}
.nqm-btn-primary{background:var(--accent);color:var(--text);box-shadow:var(--sh-sm)}
.nqm-btn-ghost{background:transparent;color:var(--text);border:2px solid var(--divider)}
.nqm-btn-lift{transition:transform .2s ease,box-shadow .2s ease}
.nqm-btn-lift:hover{transform:translateY(-2px);box-shadow:var(--sh-md)}
.nqm-btn-primary.nqm-btn-lg{box-shadow:var(--sh-md)}
.nqm-btn-primary.nqm-btn-lg:hover{box-shadow:var(--sh-lg)}

/* hero */
.nqm-hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:64px;align-items:center;padding:96px 0 104px}
.nqm-h1{font-size:clamp(44px,6vw,80px);line-height:1.04;letter-spacing:-.02em}
.nqm-accent-em{color:var(--accent-600);font-style:italic}
.nqm-hero-body{font-size:18px;line-height:29px;max-width:46ch;margin:28px 0 0}
.nqm-hero-badge{display:inline-block;margin-bottom:20px}
.nqm-hero-sub{font-size:15px;line-height:24px;margin:12px 0 0;color:var(--n700)}
.nqm-hero-cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px}
.nqm-micro{font-size:13px;margin:20px 0 0;color:var(--n700);display:flex;gap:10px;align-items:center}
.nqm-dot{width:8px;height:8px;background:var(--accent);display:block}
.nqm-stage{position:relative;height:520px}
.nqm-book{position:absolute;width:min(56%,270px);z-index:var(--z,1)}
.nqm-book-float{transform:rotate(var(--rot));animation-name:nqmFloat;animation-timing-function:ease-in-out;animation-iteration-count:infinite}
.nqm-book-card{background:var(--surface);box-shadow:var(--sh-lg);border-radius:var(--r-md);overflow:hidden;transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s ease}
.nqm-book:hover .nqm-book-card{transform:scale(1.04);box-shadow:0 32px 60px rgba(15,33,64,.24)}
/* Pointer hover lifts the hovered card above its siblings; the stack order
   (--z per slot) returns as soon as the pointer leaves. Hover-only media so a
   tap on touch devices never sticks a card on top. Position/rotation live on
   .nqm-book / .nqm-book-float and are untouched. */
@media (hover:hover){
  .nqm-book:hover{z-index:20}
}
/* Touch: the last tapped card (data-active, React state) sits on top and
   stays there until another card is tapped. Siblings keep their --z order.
   Only z-index changes; position, rotation and scale are untouched. */
@media (hover:none){
  .nqm-book{-webkit-tap-highlight-color:transparent}
  .nqm-book[data-active]{z-index:10}
}
.nqm-cover{aspect-ratio:3/4;position:relative;overflow:hidden;
  background:linear-gradient(160deg,var(--accent-100),var(--surface))}
.nqm-book-cap{padding:14px 16px 16px;display:flex;flex-direction:column;gap:4px;border-top:3px solid var(--accent)}
.nqm-book-title{font-family:var(--fh);font-weight:700;font-size:16px;line-height:1.2}
.nqm-book-meta{font-size:12px;color:var(--n700)}
@keyframes nqmFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}

/* sections */
.nqm-band{background:var(--surface);border-top:2px solid var(--divider);border-bottom:2px solid var(--divider)}
.nqm-band-pad{padding:96px clamp(20px,5vw,72px)}
.nqm-sec{padding:96px 0}
.nqm-h2{font-size:clamp(32px,4vw,52px);line-height:1.08;letter-spacing:-.02em}
.nqm-lead{font-size:17px;margin:14px 0 48px;color:var(--n700)}
.nqm-lead-wide{max-width:60ch}
.nqm-h3{font-size:22px;line-height:1.2;margin:10px 0 0}
.nqm-h3-sm{font-size:20px;margin:8px 0 0}
.nqm-body{font-size:15px;line-height:25px;margin:0;color:var(--n700)}
.nqm-eyebrow{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--n700)}
.nqm-rule{height:2px;border:0;margin:0;background:var(--divider)}

/* steps */
.nqm-progress{position:relative;height:2px;background:var(--n200)}
.nqm-progress-fill{position:absolute;left:0;top:0;bottom:0;background:var(--accent);transition:width .2s linear}
.nqm-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:24px;margin-top:32px}
.nqm-card{background:var(--bg);display:flex;flex-direction:column;gap:12px}
.nqm-step{padding:32px 28px;box-shadow:var(--sh-md);border-radius:var(--r-md)}
.nqm-step-head{display:flex;align-items:center;gap:14px}
.nqm-step-num{width:48px;height:48px;display:grid;place-items:center;background:var(--text);color:var(--accent-400);font-family:var(--fh);font-weight:700;font-size:22px;border-radius:var(--r-sm)}
.nqm-lift{transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s ease}
.nqm-step.nqm-lift:hover{transform:translateY(-6px);box-shadow:var(--sh-lg)}

/* features */
.nqm-features{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px}
.nqm-feature{background:var(--surface);padding:28px;box-shadow:var(--sh-sm);border-radius:var(--r-md)}
.nqm-feature.nqm-lift:hover{transform:translateY(-6px);box-shadow:var(--sh-lg)}
.nqm-ficon{width:48px;height:48px;display:grid;place-items:center;background:var(--accent-100);color:var(--accent-700);border-radius:var(--r-sm);
  transition:transform .6s cubic-bezier(.2,1.4,.3,1),background .3s ease,color .3s ease}
.nqm-feature:hover .nqm-ficon{background:var(--accent);color:var(--text);transform:rotate(360deg)}

/* pricing */
.nqm-plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:20px;align-items:stretch}
.nqm-plan{padding:30px 26px;background:var(--surface);color:var(--text);box-shadow:var(--sh-md);border-radius:var(--r-md);display:flex;flex-direction:column;gap:14px;position:relative}
.nqm-plan.is-popular{background:var(--text);color:var(--bg);box-shadow:var(--sh-lg)}
.nqm-plan.nqm-lift:hover{transform:translateY(-8px);box-shadow:var(--sh-lg)}
.nqm-plan-head{display:flex;justify-content:space-between;align-items:center;min-height:24px}
.nqm-plan-name{font-family:var(--fh);font-weight:700;font-size:20px}
.nqm-badge{background:var(--accent);color:var(--text);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:6px}
.nqm-plan-price{display:flex;align-items:baseline;gap:6px}
.nqm-price{font-family:var(--fh);font-size:44px;font-weight:700;line-height:1}
.nqm-unit{font-size:14px;opacity:.8}
.nqm-plan-items{display:flex;flex-direction:column;border-top:1px solid var(--n200)}
.nqm-plan.is-popular .nqm-plan-items{border-top-color:rgba(255,255,255,.18)}
.nqm-plan-item{padding:9px 0;border-bottom:1px solid var(--n200);font-size:14px;display:flex;gap:10px;align-items:center}
.nqm-plan.is-popular .nqm-plan-item{border-bottom-color:rgba(255,255,255,.18)}
.nqm-check{flex:none;color:var(--accent-600)}
.nqm-plan.is-popular .nqm-check{color:var(--accent-400)}
.nqm-plan-btn{margin-top:auto;justify-content:flex-start}

/* closing cta */
.nqm-cta{background:var(--text);color:var(--bg);overflow:hidden;position:relative}
.nqm-cta-grid{padding:104px clamp(20px,5vw,72px);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:40px;align-items:center}
.nqm-cta-h{font-size:clamp(34px,4.6vw,60px);line-height:1.06;letter-spacing:-.02em;max-width:18ch;color:var(--bg)}
.nqm-accent-400{color:var(--accent-400)}
.nqm-cta-sub{font-size:17px;margin:20px 0 0;color:var(--n200)}
.nqm-cta-btn{box-shadow:0 12px 30px rgba(197,154,0,.35)}
.nqm-feather{width:clamp(120px,16vw,220px);height:auto;transition:transform .2s linear}

/* footer */
.nqm-footer{padding:48px clamp(20px,5vw,72px) 32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:32px;font-size:14px}
.nqm-foot-brand{display:flex;flex-direction:column;gap:8px}
.nqm-foot-logo{font-family:var(--fh);font-weight:700;font-size:20px;display:flex;align-items:center;gap:8px}
.nqm-muted{color:var(--n700)}
.nqm-foot-col{display:flex;flex-direction:column;gap:8px}
.nqm-foot-col a:hover{color:var(--accent-700)}
.nqm-copyright{grid-column:1/-1;padding-top:20px;border-top:2px solid var(--divider);font-size:13px;color:var(--n700)}

@media (max-width:640px){
  .nqm-hero{padding:56px 0 64px;gap:40px}
  .nqm-stage{height:440px}
  .nqm-band-pad,.nqm-sec{padding-top:64px;padding-bottom:64px}
  .nqm-cta-grid{grid-template-columns:1fr;padding:72px clamp(20px,5vw,72px)}
  .nqm-feather{justify-self:center}
  /* Compact footer: brand on top, the two nav columns side by side, legal
     links in one row, copyright last. Same links and hrefs as desktop. */
  .nqm-footer{grid-template-columns:1fr 1fr;gap:16px 24px;padding-top:36px;padding-bottom:24px}
  .nqm-foot-brand,.nqm-foot-legal{grid-column:1/-1}
  .nqm-foot-brand{margin-bottom:4px}
  .nqm-foot-col{gap:0}
  .nqm-foot-col a{padding:6px 0}
  .nqm-foot-legal{flex-direction:row;flex-wrap:wrap;gap:0 24px}
  .nqm-copyright{padding-top:14px}
}
@media (prefers-reduced-motion: reduce){
  .nqm-root *{animation:none !important}
  .nqm-book-float{animation:none !important}
  .nqm-feather,.nqm-stage{transform:none !important}
}
`
