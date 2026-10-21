const TITLES_KEY = 'crm.sessionTitles'
const HIDDEN_KEY = 'crm.hiddenSessions'

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getSessionTitles() {
  return readJson(TITLES_KEY, {})
}

export function getHiddenSessionIds() {
  return new Set(readJson(HIDDEN_KEY, []))
}

export function getDisplayTitle(session) {
  const titles = getSessionTitles()
  return titles[session.session_id] || session.title
}

export function renameSession(sessionId, title) {
  const trimmed = title.trim()
  if (!trimmed) return

  const titles = getSessionTitles()
  titles[sessionId] = trimmed
  writeJson(TITLES_KEY, titles)
}

export function hideSession(sessionId) {
  const hidden = readJson(HIDDEN_KEY, [])
  if (!hidden.includes(sessionId)) {
    hidden.push(sessionId)
    writeJson(HIDDEN_KEY, hidden)
  }
}

export function visibleSessions(sessions) {
  const hidden = getHiddenSessionIds()
  return sessions.filter(session => !hidden.has(session.session_id))
}
