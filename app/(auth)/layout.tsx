import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-50 flex flex-col">
      <div className="p-6">
        <Link href="/" className="font-serif text-xl font-semibold text-oxford">
          Nest &amp; Quill
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        {children}
      </div>
    </div>
  )
}
