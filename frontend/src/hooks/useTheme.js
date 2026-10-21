import { useEffect, useState } from 'react'

const STORAGE_KEY = 'crm.theme'

function applyTheme(mode) {
  const root = document.documentElement

  if (mode === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode)
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'system'
  )

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  function cycleTheme() {
    setTheme(current => {
      if (current === 'light') return 'dark'
      if (current === 'dark') return 'system'
      return 'light'
    })
  }

  const label =
    theme === 'light'
      ? 'Light mode'
      : theme === 'dark'
        ? 'Dark mode'
        : 'System theme'

  return { theme, cycleTheme, label }
}
