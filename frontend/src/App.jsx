import { useEffect, useRef, useState } from 'react'
import { apiRequest } from './api'
import ApprovalPanel from './components/ApprovalPanel'
import ChatHeader from './components/ChatHeader'
import ChatInput from './components/ChatInput'
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

export default function App() {
  // ---------- State ----------
  const [messages, setMessages] = useState([]) // messages shown in the chat
  const [sessions, setSessions] = useState([]) // chat list from the backend
  const [input, setInput] = useState('') // text in the input box

  // Current chat id; starts from the id saved in localStorage (if any)
  const [sessionId, setSessionId] = useState(
    () => localStorage.getItem('crm.session')
  )

  const [proposal, setProposal] = useState(null) // pending approval, or null
  const [busy, setBusy] = useState(true) // true while a request runs (starts true for the initial restore)
  const [error, setError] = useState('') // error banner text
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile sidebar drawer
  const [metaVersion, setMetaVersion] = useState(0) // bumped to re-render after rename/hide

  // ---------- Refs (do not trigger re-renders) ----------
  const inFlight = useRef(false) // instant lock against double requests
  const chatScrollRef = useRef(null) // the scrollable chat element
  const prevCount = useRef(0) // previous message count (for scroll behavior)
  const { theme, cycleTheme, label: themeLabel } = useTheme()

  // Sessions without the ones the user hid locally
  const displaySessions = visibleSessions(sessions)

  // ---------- Helpers ----------

  // Append one message to the end of the chat
  function addMessage(role, content) {
    setMessages(previous => [
      ...previous,
      {
        id: crypto.randomUUID(),
        role,
        content,
      },
    ])
  }

  // Replace the whole screen with a saved conversation from the backend
  function applyHistory(data) {
    setSessionId(data.session_id)
    setMessages(data.messages)
    setProposal(
      data.status === 'approval_required' ? data : null
    )
  }

  // Handle a /chat or /approve response:
  // either show the approval panel or add the assistant's answer
  function handleResult(data) {
    setSessionId(data.session_id)

    if (data.status === 'approval_required') {
      setProposal(data)
    } else {
      setProposal(null)
      addMessage('assistant', data.answer)
    }
  }

  // Reload the chat list for the sidebar
  async function refreshSessions() {
    const data = await apiRequest('/sessions')
    setSessions(data.sessions)
  }

  // ---------- Effects ----------

  // Keep localStorage in sync with the current session id
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('crm.session', sessionId)
    } else {
      localStorage.removeItem('crm.session')
    }
  }, [sessionId])

  // Scroll to the bottom when content changes
  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return

    const added = messages.length - prevCount.current
    prevCount.current = messages.length

    // Smooth for a single new message, instant otherwise
    el.scrollTo({
      top: el.scrollHeight,
      behavior: added === 1 ? 'smooth' : 'auto',
    })
  }, [messages, proposal, busy])

  // Close the sidebar with the Escape key while it is open
  useEffect(() => {
    if (!sidebarOpen) return

    function onKeyDown(event) {
      if (event.key === 'Escape') setSidebarOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown) // cleanup
  }, [sidebarOpen])

  // On first load: restore the sidebar list and the last opened chat
  useEffect(() => {
    let cancelled = false // set to true if the component unmounts mid-request

    inFlight.current = true

    async function restoreWorkspace() {
      try {
        // Load the saved conversations for this visitor.
        const savedSessions = await apiRequest('/sessions')

        if (cancelled) return

        setSessions(savedSessions.sessions)

        // Check whether the browser remembers an open conversation.
        const savedId = localStorage.getItem('crm.session')

        if (savedId) {
          try {
            const history = await apiRequest(`/sessions/${savedId}`)

            if (cancelled) return

            setSessionId(history.session_id)
            setMessages(history.messages)
            setProposal(
              history.status === 'approval_required' ? history : null
            )
          } catch (requestError) {
            if (cancelled) return

            // Handle an expired conversation by starting fresh.
            if (requestError.status === 404) {
              localStorage.removeItem('crm.session')
              setSessionId(null)
              setMessages([])
              setProposal(null)
              setError('')
            } else {
              throw requestError
            }
          }
        }
      } catch (requestError) {
        // Display unexpected errors, including failure to load the list.
        if (!cancelled) {
          setError(requestError.message)
        }
      } finally {
        // Release the request lock and finish loading.
        if (!cancelled) {
          inFlight.current = false
          setBusy(false)
        }
      }
    }

    restoreWorkspace()

    // Ignore results from this effect after cleanup.
    return () => {
      cancelled = true
    }
  }, [])

  // ---------- Actions ----------

  // Open a saved chat from the sidebar
  async function openSession(id) {
    if (inFlight.current) return

    inFlight.current = true
    setBusy(true)
    setError('')

    try {
      const data = await apiRequest(`/sessions/${id}`)

      applyHistory(data)
      setInput('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  // Send the typed message to the backend
  async function sendMessage() {
    const message = input.trim()

    // Ignore empty input, running requests, and pending approvals
    if (!message || inFlight.current || proposal) return

    inFlight.current = true
    setBusy(true)
    setError('')
    setInput('')
    addMessage('user', message) // show it immediately (optimistic update)

    try {
      const body = { message }

      // New chats have no id yet; the backend creates one
      if (sessionId) {
        body.session_id = sessionId
      }

      const data = await apiRequest('/chat', body)

      handleResult(data)

      // Refresh the sidebar; a failure here should not hide the reply
      try {
        await refreshSessions()
      } catch {
        // Refreshing the page or selecting a chat can retry later.
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  // Approve or reject the pending database change
  async function decideApproval(approved) {
    if (!proposal || inFlight.current) return

    inFlight.current = true
    setBusy(true)
    setError('')

    try {
      const data = await apiRequest('/approve', {
        session_id: proposal.session_id,
        approval_id: proposal.approval_id,
        approved,
      })

      handleResult(data)

      try {
        await refreshSessions()
      } catch {
        // Keep the successful approval response visible.
      }
    } catch (requestError) {
      setError(requestError.message)

      // 409 = approval is stale/already handled: re-sync with the server
      if (requestError.status === 409 && sessionId) {
        try {
          applyHistory(
            await apiRequest(`/sessions/${sessionId}`)
          )
        } catch {
          // Preserve the original error.
        }
      }
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  // Start a fresh chat (the backend creates the session on the first message)
  function newChat() {
    if (inFlight.current) return

    setMessages([])
    setSessionId(null)
    setProposal(null)
    setInput('')
    setError('')
    setSidebarOpen(false)
  }

  // Rename a chat locally, then re-render to show the new title
  function handleRenameSession(id, title) {
    renameSession(id, title)
    setMetaVersion(version => version + 1)
  }

  // "Delete" a chat locally (it is only hidden, not removed from the server)
  function handleDeleteSession(id) {
    hideSession(id)
    setMetaVersion(version => version + 1)

    // If the open chat was hidden, switch to a new one
    if (id === sessionId) {
      newChat()
    }
  }

  // ---------- Derived flags ----------
  const showEmpty = messages.length === 0 && !busy // show starter prompts
  const showTyping = busy && messages.length > 0 // show typing indicator
  const inputBlocked = busy || Boolean(proposal) // block input while busy or awaiting approval
  const sending = showTyping

  // ---------- UI ----------
  return (
    <div className="workspace-shell">
      {/* Accessibility: lets keyboard users skip the sidebar */}
      <a className="skip-link" href="#main-content">
        Skip to conversation
      </a>

      {/* Dark overlay behind the mobile sidebar; click to close */}
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close conversation list"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Chat list */}
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
        {/* Top bar shown on mobile */}
        <div className="mobile-bar">
          <button
            type="button"
            className="icon-button"
            aria-expanded={sidebarOpen}
            aria-controls="conversation-sidebar"
            onClick={() => setSidebarOpen(open => !open)}
          >
            <span className="sr-only">Toggle conversation list</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <p className="mobile-bar__title">CRM Assistant</p>
          <button
            type="button"
            className="icon-button"
            onClick={newChat}
            disabled={busy}
            aria-label="Start new chat"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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

          {/* Scrollable chat area */}
          <section
            ref={chatScrollRef}
            className="chat-scroll"
            aria-label="Conversation"
            aria-busy={busy}
          >
            {/* Starter prompts: clicking one fills the input */}
            {showEmpty && (
              <EmptyState onSelectPrompt={prompt => setInput(prompt)} />
            )}

            {messages.length > 0 && (
              <MessageList
                messages={messages}
                showTyping={showTyping}
              />
            )}

            {/* Approve/reject UI for proposed database changes */}
            <ApprovalPanel
              proposal={proposal}
              busy={busy}
              onApprove={decideApproval}
              onReject={decideApproval}
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
            loading={sending}
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