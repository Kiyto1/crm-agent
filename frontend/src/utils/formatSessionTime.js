export function formatSessionTime(updatedAt) {
  if (updatedAt == null) return ''

  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)

  const startYesterday = new Date(startToday)
  startYesterday.setDate(startYesterday.getDate() - 1)

  const day = new Date(date)
  day.setHours(0, 0, 0, 0)

  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (day.getTime() === startToday.getTime()) {
    return time
  }

  if (day.getTime() === startYesterday.getTime()) {
    return 'Yesterday'
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
