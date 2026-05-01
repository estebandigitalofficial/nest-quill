import Image from 'next/image'
import Link from 'next/link'
import { getSetting } from '@/lib/settings/appSettings'

export default async function SiteFooter() {
  const classroomEnabled = await getSetting('classroom_enabled', true)
  return (
    <footer className="bg-oxford-dark py-4 sm:py-5 md:py-[5px] ls:py-2.5 px-6">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-2 md:gap-1.5 text-xs sm:text-sm text-white/55 sm:flex-row sm:justify-between">
        {/* Brand block — hidden on portrait mobile and landscape phones */}
        <div className="hidden sm:flex ls:hidden items-center gap-2 md:gap-1.5 text-left">
          <Image
            src="https://nestandquill.b-cdn.net/nestandquill%20brand%20start-03.webp"
            alt="Nest & Quill"
            width={140}
            height={42}
            className="brightness-0 invert md:w-[100px]"
          />
          <div>
            <p className="font-serif text-white/90 font-semibold md:text-xs">Nest &amp; Quill</p>
            <p className="text-xs text-white/40 mt-0.5 md:text-[10px]">A product of Bright Tale Books</p>
          </div>
        </div>
        <p className="order-first sm:order-none">© {new Date().getFullYear()} Bright Tale Books</p>
        <div className="flex items-center justify-center gap-3 md:gap-3 whitespace-nowrap">
          <Link href="/create" className="hover:text-white/90 transition-colors">Create</Link>
          <Link href="/learning" className="hover:text-white/90 transition-colors">Learning</Link>
          {classroomEnabled && <Link href="/classroom" className="hover:text-white/90 transition-colors">Classroom</Link>}
          <Link href="/pricing" className="hover:text-white/90 transition-colors">Pricing</Link>
          <Link href="/contact" className="hover:text-white/90 transition-colors">Contact</Link>
          <Link href="/privacy" className="hover:text-white/90 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-white/90 transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  )
}
