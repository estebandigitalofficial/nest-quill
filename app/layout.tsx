import type { Metadata } from 'next'
import { Playfair_Display, Nunito } from 'next/font/google'
import './globals.css'
import CookieBanner from '@/components/CookieBanner'
import ChatWidget from '@/components/ChatWidget'
import ThemeProvider from '@/components/ThemeProvider'
import { LanguageProvider } from '@/lib/i18n/context'
import { getServerLang } from '@/lib/i18n/server'
import { getDictionary, htmlLang } from '@/lib/i18n'
import { getSetting } from '@/lib/settings/appSettings'
import { getAppUrl } from '@/lib/utils/appUrl'

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
})

const APP_URL = getAppUrl()

export async function generateMetadata(): Promise<Metadata> {
  const [faviconUrl, lang] = await Promise.all([
    getSetting('branding_favicon_url', 'https://nestandquill.b-cdn.net/Nest%20and%20Quill%20favicon.webp'),
    getServerLang(),
  ])
  const t = getDictionary(lang).meta

  return {
    metadataBase: new URL(APP_URL),
    icons: {
      icon: faviconUrl,
      apple: faviconUrl,
    },
    title: {
      default: t.siteTitle,
      template: '%s | Nest & Quill',
    },
    description: t.siteDescription,
    openGraph: {
      type: 'website',
      siteName: 'Nest & Quill',
      title: t.siteTitle,
      description: t.siteDescription,
      url: APP_URL,
      locale: lang === 'es' ? 'es_US' : 'en_US',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: t.ogAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t.siteTitle,
      description: t.siteDescription,
      images: ['/og-image.png'],
    },
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The language cookie decides the first paint on the server, so there is
  // no flash of English and no hydration mismatch when switching.
  const lang = await getServerLang()
  return (
    <html lang={htmlLang(lang)} className={`${nunito.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <LanguageProvider initialLang={lang}>
            {children}
            <CookieBanner />
            <ChatWidget />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
