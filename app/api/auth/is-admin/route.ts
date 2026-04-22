import { getAdminContext } from '@/lib/admin/guard'

export async function GET() {
  const ctx = await getAdminContext()
  return Response.json({ isAdmin: !!ctx })
}
