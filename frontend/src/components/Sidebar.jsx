import { useEffect, useId, useRef, useState } from 'react'
import { formatSessionTime } from '../utils/formatSessionTime'
import { getDisplayTitle } from '../utils/sessionMeta'
import { groupSessionsByDate } from '../utils/groupSessions'

// Headings for each date group (keys match groupSessionsByDate's output)
const GROUP_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
}

// ---------- One chat row (title, time, "..." menu, rename mode) ----------
function SessionRow({
  metaTick,
  session,
  active,
  busy,
  onOpen,
  onRename,
  onDelete,
}) {
  // metaTick is not used directly. Receiving a new value makes this
  // component re-render, so getDisplayTitle() re-reads the latest titles.
  void metaTick
  const menuId = useId() // unique id linking the button to its menu (accessibility)
  const [menuOpen, setMenuOpen] = useState(false) // "..." menu visible
  const [editing, setEditing] = useState(false) // rename mode on/off
  const [draftTitle, setDraftTitle] = useState('') // text typed while renaming
  const menuRef = useRef(null) // the menu wrapper element (for outside clicks)
  const title = getDisplayTitle(session) // custom title or backend title

  // While the menu is open: close it on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return

    function handlePointer(event) {
      // Click inside the menu: ignore. Outside: close.
      if (menuRef.current?.contains(event.target)) return
      setMenuOpen(false)
    }

    function handleKey(event) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    // Cleanup: remove both listeners when the menu closes
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  // Enter rename mode, starting from the current title
  function startRename() {
    setDraftTitle(title)
    setEditing(true)
    setMenuOpen(false)
  }

  // Save the new title (the parent stores it) and leave rename mode
  function commitRename() {
    onRename(session.session_id, draftTitle)
    setEditing(false)
  }

  // Rename mode: show an input and a Save button instead of the row
  if (editing) {
    return (
      <div className="session-row session-row--editing">
        <input
          className="session-row__rename"
          value={draftTitle}
          onChange={event => setDraftTitle(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') commitRename() // Enter saves
            if (event.key === 'Escape') setEditing(false) // Escape cancels
          }}
          aria-label="Rename conversation"
          autoFocus
        />
        <button
          type="button"
          className="btn btn--xs btn--primary"
          onClick={commitRename}
        >
          Save
        </button>
      </div>
    )
  }

  // Normal mode
  return (
    <div
      className={
        active ? 'session-row session-row--active' : 'session-row'
      }
    >
      {/* Main button: opens this chat */}
      <button
        type="button"
        className="session-row__open"
        onClick={() => onOpen(session.session_id)}
        disabled={busy}
        title={title}
        aria-current={active ? 'true' : undefined}
      >
        <span className="session-row__title">{title}</span>
        <span className="session-row__time">
          {formatSessionTime(session.updated_at)}
        </span>
      </button>

      {/* "..." options menu */}
      <div className="session-row__menu-wrap" ref={menuRef}>
        <button
          type="button"
          className="session-row__menu-btn"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-controls={menuId}
          disabled={busy}
          onClick={() => setMenuOpen(open => !open)}
        >
          <span className="sr-only">Conversation options</span>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="19" cy="12" r="1.75" />
          </svg>
        </button>

        {menuOpen && (
          <ul className="session-row__menu" id={menuId} role="menu">
            <li role="none">
              <button type="button" role="menuitem" onClick={startRename}>
                Rename
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete(session.session_id)
                }}
              >
                Remove from list
              </button>
            </li>
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------- A group of rows under one heading (Today / Yesterday / Earlier) ----------
function SessionGroup({
  metaTick,
  label,
  sessions,
  sessionId,
  busy,
  onOpen,
  onRename,
  onDelete,
}) {
  // Don't render empty groups
  if (sessions.length === 0) return null

  return (
    <div className="session-group">
      <p className="session-group__label">{label}</p>
      <ul className="session-group__list">
        {sessions.map(session => (
          <li key={session.session_id}>
            <SessionRow
              metaTick={metaTick}
              session={session}
              active={session.session_id === sessionId} // highlight the open chat
              busy={busy}
              onOpen={onOpen}
              onRename={onRename}
              onDelete={onDelete}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- The sidebar itself ----------
export default function Sidebar({
  metaTick,
  open,
  onClose,
  sessions,
  sessionId,
  busy,
  onNewChat,
  onOpenSession,
  onRenameSession,
  onDeleteSession,
}) {
  void metaTick // same trick: a new value triggers a re-render
  const groups = groupSessionsByDate(sessions) // { today, yesterday, earlier }

  return (
    <aside
      id="conversation-sidebar"
      className={open ? 'sidebar sidebar--open' : 'sidebar'} // --open shows it on mobile
      aria-label="Conversation history"
    >
      {/* Brand and New chat button */}
      <div className="sidebar__top">
        <div className="sidebar__brand">
          <span className="sidebar__mark" aria-hidden="true">
            ✦
          </span>
          <span>CRM Assistant</span>
        </div>

        <button
          type="button"
          className="btn btn--primary btn--block sidebar__new"
          onClick={onNewChat}
          disabled={busy}
        >
          New chat
        </button>
      </div>

      {/* Chat list */}
      <nav className="sidebar__nav" aria-label="Saved conversations">
        {sessions.length === 0 ? (
          <p className="sidebar__empty">Your conversations will appear here.</p>
        ) : (
          // Loop over Today / Yesterday / Earlier and render each group
          Object.entries(GROUP_LABELS).map(([key, label]) => (
            <SessionGroup
              key={key}
              metaTick={metaTick}
              label={label}
              sessions={groups[key]}
              sessionId={sessionId}
              busy={busy}
              onOpen={id => {
                onOpenSession(id)
                onClose() // close the drawer on mobile after picking a chat
              }}
              onRename={onRenameSession}
              onDelete={onDeleteSession}
            />
          ))
        )}
      </nav>

      <p className="sidebar__note">
        Conversations and pending approvals are saved on the server.
      </p>
    </aside>
  )
}