// Convert a value to a Date. Returns null if it's missing or invalid.
function parseUpdatedAt(value) {
  if (value == null) return null // catches both null and undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date // invalid dates give NaN
}

// Return a copy of the date set to midnight (00:00:00.000) of the same day.
// Used to compare days while ignoring the time.
function startOfDay(date) {
  const copy = new Date(date) // copy so the original isn't changed
  copy.setHours(0, 0, 0, 0)
  return copy
}

// Split sessions into "today", "yesterday" and "earlier" for the sidebar.
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

    // No valid date: put it in "earlier"
    if (!updated) {
      groups.earlier.push(session)
      continue
    }

    const day = startOfDay(updated)

    // Compare timestamps (Date objects can't be compared with ===)
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