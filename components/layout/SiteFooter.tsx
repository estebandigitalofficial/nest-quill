import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="bg-oxford-dark py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-parchment/50">
        <p className="font-serif text-parchment font-semibold">Nest &amp; Quill</p>
        <p>© {new Date().getFullYear()} Nest &amp; Quill. All rights reserved.</p>
        <div className="flex flex-wrap justify-center gap-5">
          <Link href="/create" className="hover:text-parchment transition-colors">Create</Link>
          <Link href="/pricing" className="hover:text-parchment transition-colors">Pricing</Link>
          <Link href="/contact" className="hover:text-parchment transition-colors">Contact</Link>
          <Link href="/privacy" className="hover:text-parchment transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-parchment transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  )
}
