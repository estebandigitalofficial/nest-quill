import ProductGate from '@/components/layout/ProductGate'

// Launch scope gate (Phase 2A): the classroom area stays in the codebase but is
// shown to the public only while its launch flag is on. Admins always pass.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ProductGate area="classroom" path="/classroom">{children}</ProductGate>
}
