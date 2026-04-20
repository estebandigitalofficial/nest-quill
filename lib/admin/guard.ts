import { createClient } from '@/lib/supabase/server'

export async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    throw new Error('Unauthorized')
  }

  return user.id
}

export function adminGuardResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 403 })
}
