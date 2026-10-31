// Format a session's last-updated time for the sidebar:
//   today     -> "3:45 PM"
//   yesterday -> "Yesterday"
//   older     -> "Oct 21"
export function formatSessionTime(updatedAt) {
  // Missing or invalid dates show nothing
  if (updatedAt == null) return ''

  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return ''

  // Midnight of today and yesterday, used to compare days ignoring the time
  const now = new Date()
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)

  const startYesterday = new Date(startToday)
  startYesterday.setDate(startYesterday.getDate() - 1)

  // Midnight of the session's day
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)

  // Time in the user's locale format (e.g. "3:45 PM")
  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  // Compare timestamps (Date objects can't be compared with ===)
  if (day.getTime() === startToday.getTime()) {
    return time
  }

  if (day.getTime() === startYesterday.getTime()) {
    return 'Yesterday'
  }

  // Older: short date in the user's locale (e.g. "Oct 21")
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}