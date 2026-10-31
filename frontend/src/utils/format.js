// Small display helpers shared by the dashboard pages.
// Dates from the API are text like "2026-10-22" (or "2026-10-22 01:08:20").

// 2934850 -> "SAR 2,934,850"
export function formatMoney(value) {
  if (value == null) return '—'

  return `SAR ${Math.round(value).toLocaleString('en-US')}`
}

// 2934850 -> "SAR 2.93M" (for stat cards, where space is tight)
export function formatMoneyShort(value) {
  const short = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value || 0)

  return `SAR ${short}`
}

// Build a Date from the first 10 characters (YYYY-MM-DD) as a LOCAL date.
// new Date("2026-10-22") would be read as UTC and can show the day before.
function parseDay(text) {
  const [year, month, day] = text.slice(0, 10).split('-').map(Number)

  return new Date(year, month - 1, day)
}

// "2026-10-22" -> "22 Oct 2026"
export function formatDate(text) {
  if (!text) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseDay(text))
}

// Whole days from `from` to `to` (both YYYY-MM-DD). Positive if `to` is later.
export function daysBetween(from, to) {
  return Math.round((parseDay(to) - parseDay(from)) / 86400000)
}

// Add days to a YYYY-MM-DD date and return YYYY-MM-DD.
export function addDays(text, days) {
  const date = parseDay(text)

  date.setDate(date.getDate() + days)

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}
