import { useEffect, useRef, useState } from 'react'
import { apiRequest } from './api'

import ApprovalPanel from './components/ApprovalPanel'
import ChatHeader from './components/ChatHeader'
import ChatInput from './components/ChatInput'
import DemoGuide from './components/DemoGuide'
import EmptyState from './components/EmptyState'
import MessageList from './components/MessageList'
import Sidebar from './components/Sidebar'

import { useTheme } from './hooks/useTheme'

import {
  hideSession,
  renameSession,
  visibleSessions,
} from './utils/sessionMeta'

import './App.css'


const SESSION_KEY = 'crm.session'

// localStorage can throw (private mode, blocked storage), so wrap it.
function readStoredSession() {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function writeStoredSession(id) {
  try {
    if (id) {
      localStorage.setItem(SESSION_KEY, id)
    } else {
      localStorage.removeItem(SESSION_KEY)
    }
  } catch {
    // Storage unavailable; the chat still works without persistence.
  }
}


export default function App() {
  // Messages and conversations displayed by the interface.
  const [messages, setMessages] = useState([])
  const [sessions, setSessions] = useState([])
  const [input, setInput] = useState('')

  // Restore the last selected conversation ID from this browser.
  const [sessionId, setSessionId] = useState(readStoredSession)

  // Pending database changes and interface status.
  const [proposal, setProposal] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Trigger a render after locally renaming or hiding conversations.
  const [metaVersion, setMetaVersion] = useState(0)

  // Refs remember values without triggering renders.
  const inFlight = useRef(false)
  const chatScrollRef = useRef(null)
  const prevCount = useRef(0)

  const {
    theme,
    cycleTheme,
    label: themeLabel,
  } = useTheme()

  // Exclude conversations hidden locally by this browser.
  const displaySessions = visibleSessions(sessions)


  function addMessage(role, content) {
    const id = crypto.randomUUID()

    setMessages(previous => [...previous, { id, role, content }])

    return id
  }


  function removeMessage(id) {
    setMessages(previous => previous.filter(m => m.id !== id))
  }


  function applyHistory(data) {
    // Replace the current display with a saved conversation.
    setSessionId(data.session_id)
    setMessages(data.messages)

    setProposal(
      data.status === 'approval_required' ? data : null
    )
  }


  function handleResult(data) {
    // Handle either a normal answer or a proposed database change.
    setSessionId(data.session_id)

    if (data.status === 'approval_required') {
      setProposal(data)
    } else {
      setProposal(null)
      addMessage('assistant', data.answer)
    }
  }


  async function refreshSessions() {
    // A sidebar refresh failure should never hide a successful result.
    try {
      const data = await apiRequest('/sessions')
      setSessions(data.sessions)
    } catch {
      // Ignore.
    }
  }


  // Runs one request at a time and handles busy/error state in one place.
  async function runRequest(task) {
    if (inFlight.current) return

    inFlight.current = true
    setBusy(true)
    setError('')

    try {
      await task()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }


  // Keep the selected conversation ID in browser storage.
  useEffect(() => {
    writeStoredSession(sessionId)
  }, [sessionId])


  // Scroll to the latest conversation content.
  useEffect(() => {
    const el = chatScrollRef.current

    if (!el) return

    const added = messages.length - prevCount.current
    prevCount.current = messages.length

    el.scrollTo({
      top: el.scrollHeight,
      behavior: added === 1 ? 'smooth' : 'auto',
    })
  }, [messages, proposal, busy])


  // Allow Escape to close the mobile sidebar.
  useEffect(() => {
    if (!sidebarOpen) return

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [sidebarOpen])


  // Restore saved conversations and the previously selected chat.
  useEffect(() => {
    let cancelled = false

    inFlight.current = true

    async function restoreWorkspace() {
      try {
        const saved = await apiRequest('/sessions')

        if (cancelled) return

        setSessions(saved.sessions)

        const savedId = readStoredSession()

        if (!savedId) return

        try {
          const history = await apiRequest(`/sessions/${savedId}`)

          if (cancelled) return

          applyHistory(history)
        } catch (requestError) {
          if (cancelled) return

          if (requestError.status === 404) {
            // Free hosting may reset the saved server data.
            // Forget the expired conversation and start fresh.
            setSessionId(null)
            setMessages([])
            setProposal(null)
          } else {
            throw requestError
          }
        }
      } catch (requestError) {
        // Display unexpected errors, such as a failed connection.
        if (!cancelled) {
          setError(requestError.message)
        }
      } finally {
        if (!cancelled) {
          inFlight.current = false
          setBusy(false)
        }
      }
    }

    restoreWorkspace()

    // Ignore results after this effect has been cleaned up.
    return () => {
      cancelled = true
    }
  }, [])


  function openSession(id) {
    return runRequest(async () => {
      const data = await apiRequest(`/sessions/${id}`)

      applyHistory(data)
      setInput('')
      setSidebarOpen(false)
    })
  }


  function sendMessage() {
    const message = input.trim()

    // Prevent empty messages and sending while changes await approval.
    if (!message || proposal) return

    return runRequest(async () => {
      setInput('')

      // Display the user's message immediately.
      const pendingId = addMessage('user', message)

      try {
        const body = { message }

        // Omit the ID for new chats so the backend creates one.
        if (sessionId) {
          body.session_id = sessionId
        }

        const data = await apiRequest('/chat', body)

        handleResult(data)
      } catch (requestError) {
        // Undo the optimistic message and give the text back for retry.
        removeMessage(pendingId)
        setInput(message)
        throw requestError
      }

      await refreshSessions()
    })
  }


  function decideApproval(approved) {
    if (!proposal) return

    return runRequest(async () => {
      try {
        const data = await apiRequest('/approve', {
          session_id: proposal.session_id,
          approval_id: proposal.approval_id,
          approved,
        })

        handleResult(data)
      } catch (requestError) {
        // Reload the conversation if the approval was already handled
        // or no longer matches the server's current state.
        if (requestError.status === 409 && sessionId) {
          try {
            applyHistory(await apiRequest(`/sessions/${sessionId}`))
          } catch {
            // Preserve the original error.
          }
        }

        throw requestError
      }

      await refreshSessions()
    })
  }


  function newChat() {
    if (inFlight.current) return

    // Clear the interface without deleting previous server history.
    setMessages([])
    setSessionId(null)
    setProposal(null)
    setInput('')
    setError('')
    setSidebarOpen(false)
  }


  function handleRenameSession(id, title) {
    // Custom titles are stored locally in this browser.
    renameSession(id, title)
    setMetaVersion(version => version + 1)
  }


  function handleDeleteSession(id) {
    // Hide the conversation locally rather than deleting server data.
    hideSession(id)
    setMetaVersion(version => version + 1)

    if (id === sessionId) {
      newChat()
    }
  }


  // Calculate interface conditions from the current state.
  const showEmpty = messages.length === 0 && !busy
  const showTyping = busy && messages.length > 0
  const inputBlocked = busy || Boolean(proposal)


  return (
    <div className="workspace-shell">
      {/* Keyboard users can skip directly to the conversation. */}
      <a className="skip-link" href="#main-content">
        Skip to conversation
      </a>

      {/* Close the mobile sidebar when its backdrop is clicked. */}
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close conversation list"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        metaTick={metaVersion}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={displaySessions}
        sessionId={sessionId}
        busy={busy}
        onNewChat={newChat}
        onOpenSession={openSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
      />

      <main className="app" id="main-content">
        {/* Compact navigation controls for smaller screens. */}
        <div className="mobile-bar">
          <button
            type="button"
            className="icon-button"
            aria-expanded={sidebarOpen}
            aria-controls="conversation-sidebar"
            onClick={() => setSidebarOpen(open => !open)}
          >
            <span className="sr-only">
              Toggle conversation list
            </span>

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <p className="mobile-bar__title">
            CRM Assistant
          </p>

          <button
            type="button"
            className="icon-button"
            onClick={newChat}
            disabled={busy}
            aria-label="Start new chat"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <div className="chat-column">
          <ChatHeader
            theme={theme}
            onToggleTheme={cycleTheme}
            themeLabel={themeLabel}
          />

          <section
            ref={chatScrollRef}
            className="chat-scroll"
            aria-label="Conversation"
            aria-busy={busy}
          >
            {/* Explain the demo, its CSV data, and suggested tests. */}
            <DemoGuide
              onSelectPrompt={setInput}
              disabled={inputBlocked}
            />

            {/* Starter cards fill the input without submitting it. */}
            {showEmpty && (
              <EmptyState onSelectPrompt={setInput} />
            )}

            {messages.length > 0 && (
              <MessageList
                messages={messages}
                showTyping={showTyping}
              />
            )}

            {/* Show proposed changes before they are approved. */}
            <ApprovalPanel
              proposal={proposal}
              busy={busy}
              onApprove={() => decideApproval(true)}
              onReject={() => decideApproval(false)}
            />

            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
          </section>

          <ChatInput
            value={input}
            onChange={setInput}
            onSend={sendMessage}
            disabled={inputBlocked}
            loading={showTyping}
            placeholder={
              proposal
                ? 'Review the proposed changes above…'
                : 'Ask your CRM assistant…'
            }
          />

          <p className="footer-note">
            Changes require your approval. Saved chats can be reopened.
          </p>
        </div>
      </main>
    </div>
  )
}