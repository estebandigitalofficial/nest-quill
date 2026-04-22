import type { Metadata } from 'next'
import { Lora, Nunito } from 'next/font/google'
import './globals.css'
import CookieBanner from '@/components/CookieBanner'

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Nest & Quill — Personalized Storybooks for Children',
    template: '%s | Nest & Quill',
  },
  description:
    'Create a one-of-a-kind illustrated storybook starring your child. Powered by AI, delivered to your inbox.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${nunito.variable} ${lora.variable}`}>
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  )
}
