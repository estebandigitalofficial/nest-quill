import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parchment flex flex-col">
      <SiteHeader />
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-4 py-16">
        {children}
      </div>
      <SiteFooter />
    </div>
  )
}
