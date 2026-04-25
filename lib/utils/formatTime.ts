const AZ_LOCALE_OPTS_FULL: Intl.DateTimeFormatOptions = {
  timeZone: 'America/Phoenix',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
}

const AZ_LOCALE_OPTS_SHORT: Intl.DateTimeFormatOptions = {
  timeZone: 'America/Phoenix',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
}

const AZ_LOCALE_OPTS_TIME_ONLY: Intl.DateTimeFormatOptions = {
  timeZone: 'America/Phoenix',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
}

// "Jan 15, 2025 at 2:34 PM MST"
export function formatAZTime(ts: string): string {
  return new Date(ts).toLocaleString('en-US', AZ_LOCALE_OPTS_FULL) + ' MST'
}

// "Jan 15 at 2:34 PM"
export function formatAZTimeShort(ts: string): string {
  return new Date(ts).toLocaleString('en-US', AZ_LOCALE_OPTS_SHORT)
}

// "2:34:01 PM"
export function formatAZTimeOnly(ts: string): string {
  return new Date(ts).toLocaleString('en-US', AZ_LOCALE_OPTS_TIME_ONLY)
}
