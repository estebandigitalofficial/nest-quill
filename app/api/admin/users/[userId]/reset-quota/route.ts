import { NextResponse } from 'next/server'

// POST /api/admin/users/[id]/reset-quota — RETIRED.
//
// This route used to duplicate /reset-usage (both zeroed books_generated).
// Commercial entitlement state now has explicit routes:
//   /reset-usage           → legacy books_generated counter only
//   /reset-free-allowance  → profiles.free_books_used (the two Free books)
//   /grant                 → complimentary purchase / period
// Answering 410 keeps any stale client from silently changing state.
export async function POST() {
  return NextResponse.json(
    { message: 'reset-quota is retired. Use reset-usage (legacy counter) or reset-free-allowance (Free books).', code: 'ROUTE_RETIRED' },
    { status: 410 },
  )
}
