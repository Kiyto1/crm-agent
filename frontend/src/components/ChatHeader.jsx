const THEME_ICONS = {
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  dark: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  system: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
}

export default function ChatHeader({ theme = 'system', onToggleTheme, themeLabel }) {
  return (
    <header className="chat-header">
      <div className="chat-header__brand">
        <div className="chat-header__mark" aria-hidden="true">
          ✦
        </div>
        <div className="chat-header__text">
          <h1 className="chat-header__title">CRM Assistant</h1>
          <p className="chat-header__subtitle">Contacts · Notes · Follow-ups</p>
        </div>
      </div>

      <div className="chat-header__actions">
        <span className="chat-header__pill">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 3l8 3v6c0 4.5-3.2 7.9-8 9-4.8-1.1-8-4.5-8-9V6l8-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          Changes need approval
        </span>

        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Theme: ${themeLabel}. Click to change.`}
          title={themeLabel}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            {THEME_ICONS[theme] || THEME_ICONS.system}
          </svg>
        </button>
      </div>
    </header>
  )
}