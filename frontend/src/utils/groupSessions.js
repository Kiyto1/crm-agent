function parseUpdatedAt(value) {
  if (value == null) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function groupSessionsByDate(sessions) {
  const today = startOfDay(new Date())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const groups = {
    today: [],
    yesterday: [],
    earlier: [],
  }

  for (const session of sessions) {
    const updated = parseUpdatedAt(session.updated_at)
    if (!updated) {
      groups.earlier.push(session)
      continue
    }

    const day = startOfDay(updated)

    if (day.getTime() === today.getTime()) {
      groups.today.push(session)
    } else if (day.getTime() === yesterday.getTime()) {
      groups.yesterday.push(session)
    } else {
      groups.earlier.push(session)
    }
  }

  return groups
}
