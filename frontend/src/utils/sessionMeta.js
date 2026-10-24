// localStorage keys used by this module
const TITLES_KEY = 'crm.sessionTitles' // { sessionId: "custom title" }
const HIDDEN_KEY = 'crm.hiddenSessions' // ["sessionId", ...]

// Read and parse JSON from localStorage.
// Returns `fallback` if the key is missing or the data is corrupted.
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

// Convert a value to JSON and save it in localStorage.
function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

// Get all custom titles as an object: { sessionId: title }.
export function getSessionTitles() {
  return readJson(TITLES_KEY, {})
}

// Get hidden session ids as a Set for fast lookups with .has().
export function getHiddenSessionIds() {
  return new Set(readJson(HIDDEN_KEY, []))
}

// Return the custom title if one exists, otherwise the backend's title.
export function getDisplayTitle(session) {
  const titles = getSessionTitles()
  return titles[session.session_id] || session.title
}

// Save a custom title for a session. Empty names are ignored.
export function renameSession(sessionId, title) {
  const trimmed = title.trim()
  if (!trimmed) return

  const titles = getSessionTitles()
  titles[sessionId] = trimmed
  writeJson(TITLES_KEY, titles)
}

// Hide a session locally (the backend is not told). No duplicates.
export function hideSession(sessionId) {
  const hidden = readJson(HIDDEN_KEY, [])
  if (!hidden.includes(sessionId)) {
    hidden.push(sessionId)
    writeJson(HIDDEN_KEY, hidden)
  }
}

// Filter out hidden sessions from a list of sessions.
export function visibleSessions(sessions) {
  const hidden = getHiddenSessionIds()
  return sessions.filter(session => !hidden.has(session.session_id))
}