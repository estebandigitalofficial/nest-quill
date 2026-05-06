// Shared page size for the /account list, /account/archived list, and the
// /api/account/stories endpoint. Lifted out of the route file because
// Next.js disallows named exports from route handlers.
export const PAGE_SIZE = 25
