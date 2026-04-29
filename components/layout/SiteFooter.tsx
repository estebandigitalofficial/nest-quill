import Image from 'next/image'
import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="bg-oxford-dark py-4 sm:py-5 md:py-10 ls:py-2.5 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 md:gap-4 text-xs sm:text-sm text-parchment/50">
        {/* Brand block — hidden on portrait mobile and landscape phones (adds height) */}
        <div className="hidden sm:flex ls:hidden items-center gap-3 text-left">
          <Image
            src="https://nestandquill.b-cdn.net/nestandquill%20brand%20start-04.webp"
            alt="Nest & Quill"
            width={56}
            height={56}
            className="rounded-lg"
          />
          <div>
            <p className="font-serif text-parchment font-semibold">Nest &amp; Quill</p>
            <p className="text-xs text-parchment/40 mt-0.5">A product of Bright Tale Books</p>
          </div>
        </div>
        <p>© {new Date().getFullYear()} Bright Tale Books</p>
        <div className="flex flex-wrap justify-center gap-3 md:gap-5">
          <Link href="/create" className="hover:text-parchment transition-colors">Create</Link>
          <Link href="/learning" className="hover:text-parchment transition-colors">Learning</Link>
          <Link href="/classroom" className="hover:text-parchment transition-colors">Classroom</Link>
          <Link href="/pricing" className="hover:text-parchment transition-colors">Pricing</Link>
          <Link href="/contact" className="hover:text-parchment transition-colors">Contact</Link>
          <Link href="/privacy" className="hover:text-parchment transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-parchment transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  )
}
