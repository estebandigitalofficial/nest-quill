import { redirect } from 'next/navigation'

// Legacy pre-redesign landing page. It was unlinked but still reachable and
// carried claims that contradict the launch model (unlimited free stories,
// "ages 2-10", beta copy). The homepage is the one public landing now.
export default function StorybooksPage() {
  redirect('/')
}
