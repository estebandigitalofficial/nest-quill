import ProductGate from '@/components/layout/ProductGate'

// Launch scope gate: the publishing area stays in the codebase but is shown
// to the public only while its launch flag is on. Admins always pass.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ProductGate area="publishing" path="/publish">{children}</ProductGate>
}
