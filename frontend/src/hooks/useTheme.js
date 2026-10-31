import { useEffect, useState } from 'react'

// localStorage key where the chosen theme is saved
const STORAGE_KEY = 'crm.theme'

// Apply a theme by setting the data-theme attribute on <html>.
// CSS can then style it, e.g. [data-theme="dark"] { ... }
function applyTheme(mode) {
  const root = document.documentElement // the <html> element

  if (mode === 'system') {
    // No attribute: let the OS preference decide (prefers-color-scheme)
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode) // 'light' or 'dark'
  }
}

// localStorage can throw (private mode, blocked cookies), so wrap it.
function readSavedTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'system'
  } catch {
    return 'system'
  }
}

// Custom hook: manages the theme and remembers it between visits.
export function useTheme() {
  // Start from the saved theme, or 'system' if none is saved
  const [theme, setTheme] = useState(readSavedTheme)

  // Whenever the theme changes: update the page and save the choice
  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Storage blocked (private mode): the theme still works for this visit.
    }
  }, [theme])

  // Switch to the next theme: light -> dark -> system -> light
  function cycleTheme() {
    setTheme(current => {
      if (current === 'light') return 'dark'
      if (current === 'dark') return 'system'
      return 'light'
    })
  }

  // Human-readable name for the current theme (for buttons/tooltips)
  const label =
    theme === 'light'
      ? 'Light mode'
      : theme === 'dark'
        ? 'Dark mode'
        : 'System theme'

  return { theme, cycleTheme, label }
}