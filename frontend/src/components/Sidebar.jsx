import { useEffect, useId, useRef, useState } from 'react'
import { formatSessionTime } from '../utils/formatSessionTime'
import { getDisplayTitle } from '../utils/sessionMeta'
import { groupSessionsByDate } from '../utils/groupSessions'

const GROUP_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
}

function SessionRow({
  metaTick,
  session,
  active,
  busy,
  onOpen,
  onRename,
  onDelete,
}) {
  void metaTick
  const menuId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const menuRef = useRef(null)
  const title = getDisplayTitle(session)

  useEffect(() => {
    if (!menuOpen) return

    function handlePointer(event) {
      if (menuRef.current?.contains(event.target)) return
      setMenuOpen(false)
    }

    function handleKey(event) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  function startRename() {
    setDraftTitle(title)
    setEditing(true)
    setMenuOpen(false)
  }

  function commitRename() {
    onRename(session.session_id, draftTitle)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="session-row session-row--editing">
        <input
          className="session-row__rename"
          value={draftTitle}
          onChange={event => setDraftTitle(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') commitRename()
            if (event.key === 'Escape') setEditing(false)
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

  return (
    <div
      className={
        active ? 'session-row session-row--active' : 'session-row'
      }
    >
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
              active={session.session_id === sessionId}
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
  void metaTick
  const groups = groupSessionsByDate(sessions)

  return (
    <aside
      id="conversation-sidebar"
      className={open ? 'sidebar sidebar--open' : 'sidebar'}
      aria-label="Conversation history"
    >
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

      <nav className="sidebar__nav" aria-label="Saved conversations">
        {sessions.length === 0 ? (
          <p className="sidebar__empty">Your conversations will appear here.</p>
        ) : (
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
                onClose()
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
