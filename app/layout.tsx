import type { Metadata } from 'next'
import { Playfair_Display, Nunito } from 'next/font/google'
import './globals.css'
import CookieBanner from '@/components/CookieBanner'
import ChatWidget from '@/components/ChatWidget'
import ThemeProvider from '@/components/ThemeProvider'
import { LanguageProvider } from '@/lib/i18n/context'

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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  icons: {
    icon: 'https://nestandquill.b-cdn.net/Nest%20and%20Quill%20favicon.webp',
    apple: 'https://nestandquill.b-cdn.net/Nest%20and%20Quill%20favicon.webp',
  },
  title: {
    default: 'Nest & Quill — Personalized Storybooks for Children',
    template: '%s | Nest & Quill',
  },
  description:
    'Create a one-of-a-kind illustrated storybook starring your child. Powered by AI, delivered to your inbox.',
  openGraph: {
    type: 'website',
    siteName: 'Nest & Quill',
    title: 'Nest & Quill — Personalized Storybooks for Children',
    description: 'Create a one-of-a-kind illustrated storybook starring your child. Powered by AI, delivered to your inbox.',
    url: APP_URL,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Nest & Quill — Personalized AI Storybooks',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nest & Quill — Personalized Storybooks for Children',
    description: 'Create a one-of-a-kind illustrated storybook starring your child. Powered by AI, delivered to your inbox.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${nunito.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <LanguageProvider>
            {children}
            <CookieBanner />
            <ChatWidget />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
