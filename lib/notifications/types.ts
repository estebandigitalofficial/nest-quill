// Shared notification type for the global bell. Today the panel renders
// from a static empty list; when we wire real notifications, the same
// shape will come from an API or a Supabase channel without requiring UI
// changes. Keep this file dependency-free so it can be imported from
// both server and client code.

export interface Notification {
  id: string
  title: string
  /** One-line preview shown beneath the title. */
  body?: string
  /** Clicking the notification navigates here when present. */
  href?: string
  /** ISO timestamp; the panel groups by recency. */
  createdAt: string
  /** Drives the unread badge + bold styling in the panel. */
  unread: boolean
}

/** True when at least one notification is unread. Drives the bell badge. */
export function hasUnread(items: readonly Notification[]): boolean {
  return items.some((n) => n.unread)
}
