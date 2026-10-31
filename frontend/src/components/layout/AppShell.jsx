import { useEffect, useRef, useState } from 'react'
import { APP_NAME, ROUTES } from '../../routes'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import AboutDemo from './AboutDemo'

const THEME_ICON = { light: 'sun', dark: 'moon', system: 'monitor' }

// The frame around every page: navigation, top bar, the content area and
// (on the right) the assistant panel, which App passes in as `panel`.
export default function AppShell({
  route,
  theme,
  themeLabel,
  onCycleTheme,
  assistantOpen,
  onToggleAssistant,
  panel,
  children,
}) {
  const [navOpen, setNavOpen] = useState(false) // mobile drawer
  const [aboutOpen, setAboutOpen] = useState(false)

  const mainRef = useRef(null)
  const previousRoute = useRef(route)

  const current = ROUTES.find(item => item.id === route)

  // After a page change, move keyboard focus to the content area so
  // screen reader and keyboard users land on the new page.
  useEffect(() => {
    if (previousRoute.current !== route) {
      previousRoute.current = route
      mainRef.current?.focus({ preventScroll: true })
    }
  }, [route])

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!navOpen) return

    function onKeyDown(event) {
      if (event.key === 'Escape') setNavOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [navOpen])

  return (
    <div className={assistantOpen ? 'shell shell--panel-open' : 'shell'}>
      {/* The URL hash is used for routing, so this link cannot
          be a plain #main-content anchor. Focus the area directly. */}
      <a
        className="skip-link"
        href="#main-content"
        onClick={event => {
          event.preventDefault()
          mainRef.current?.focus()
        }}
      >
        Skip to content
      </a>

      {navOpen && (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        id="main-nav"
        className={navOpen ? 'shell__nav shell__nav--open' : 'shell__nav'}
      >
        <div className="brand">
          <span className="brand__mark">
            <Icon name="sparkle" />
          </span>
          <span>{APP_NAME}</span>
        </div>

        <nav aria-label="Main">
          <ul className="nav-list">
            {ROUTES.map(item => (
              <li key={item.id}>
                <a
                  className="nav-link"
                  href={`#/${item.id}`}
                  aria-current={item.id === route ? 'page' : undefined}
                  onClick={() => setNavOpen(false)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="shell__nav-footer">
          <button
            type="button"
            className="nav-link"
            onClick={() => {
              setNavOpen(false)
              setAboutOpen(true)
            }}
          >
            <Icon name="info" />
            <span>About this demo</span>
          </button>
        </div>
      </aside>

      <div className="shell__body">
        <header className="topbar">
          <Button
            className="topbar__menu"
            variant="secondary"
            iconOnly
            aria-label="Open navigation"
            aria-expanded={navOpen}
            aria-controls="main-nav"
            onClick={() => setNavOpen(open => !open)}
          >
            <Icon name="menu" />
          </Button>

          <h1 className="topbar__title">{current.label}</h1>

          <div className="topbar__actions">
            <Button
              variant="secondary"
              iconOnly
              aria-label={`Theme: ${themeLabel}. Click to change.`}
              title={themeLabel}
              onClick={onCycleTheme}
            >
              <Icon name={THEME_ICON[theme] || 'monitor'} />
            </Button>

            <Button
              variant="primary"
              aria-pressed={assistantOpen}
              aria-controls="assistant-panel"
              onClick={onToggleAssistant}
            >
              <Icon name="sparkle" size={16} />
              Assistant
            </Button>
          </div>
        </header>

        <main
          id="main-content"
          className="shell__content"
          ref={mainRef}
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      {panel}

      <AboutDemo open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}
