import type { ReactNode } from 'react'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export default function CreateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh bg-parchment flex flex-col">
      <SiteHeader />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <SiteFooter />
    </div>
  )
}
