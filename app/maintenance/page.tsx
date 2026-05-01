import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Down for Maintenance — Nest & Quill' }

export default function MaintenancePage() {
  return (
    <div className="h-dvh bg-parchment flex items-center justify-center px-6">
      <div className="max-w-sm text-center space-y-4">
        <p className="text-4xl">🔧</p>
        <h1 className="font-serif text-2xl text-oxford">Down for Maintenance</h1>
        <p className="text-sm text-charcoal-light leading-relaxed">
          We&apos;re currently making improvements. Please check back soon.
        </p>
      </div>
    </div>
  )
}
