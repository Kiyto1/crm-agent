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
  const [messages, setMessages] = useState([])
  const [sessions, setSessions] = useState([])
  const [input, setInput] = useState('')

  const [sessionId, setSessionId] = useState(
    () => localStorage.getItem('crm.session')
  )

  const [proposal, setProposal] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [metaVersion, setMetaVersion] = useState(0)

  const inFlight = useRef(false)
  const chatScrollRef = useRef(null)
  const prevCount = useRef(0)
  const { theme, cycleTheme, label: themeLabel } = useTheme()

  const displaySessions = visibleSessions(sessions)

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

  function applyHistory(data) {
    setSessionId(data.session_id)
    setMessages(data.messages)
    setProposal(
      data.status === 'approval_required' ? data : null
    )
  }

  function handleResult(data) {
    setSessionId(data.session_id)

    if (data.status === 'approval_required') {
      setProposal(data)
    } else {
      setProposal(null)
      addMessage('assistant', data.answer)
    }
  }

  async function refreshSessions() {
    const data = await apiRequest('/sessions')
    setSessions(data.sessions)
  }

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('crm.session', sessionId)
    } else {
      localStorage.removeItem('crm.session')
    }
  }, [sessionId])

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

  useEffect(() => {
    if (!sidebarOpen) return

    function onKeyDown(event) {
      if (event.key === 'Escape') setSidebarOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen])

  useEffect(() => {
    let cancelled = false

    inFlight.current = true

    async function restoreWorkspace() {
      try {
        const savedSessions = await apiRequest('/sessions')

        if (cancelled) return

        setSessions(savedSessions.sessions)

        const savedId = localStorage.getItem('crm.session')

        if (savedId) {
          const history = await apiRequest(`/sessions/${savedId}`)

          if (!cancelled) {
            setSessionId(history.session_id)
            setMessages(history.messages)
            setProposal(
              history.status === 'approval_required' ? history : null
            )
          }
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message)

          if (requestError.status === 404) {
            setSessionId(null)
          }
        }
      } finally {
        if (!cancelled) {
          inFlight.current = false
          setBusy(false)
        }
      }
    }

    restoreWorkspace()

    return () => {
      cancelled = true
    }
  }, [])

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

  async function sendMessage() {
    const message = input.trim()

    if (!message || inFlight.current || proposal) return

    inFlight.current = true
    setBusy(true)
    setError('')
    setInput('')
    addMessage('user', message)

    try {
      const body = { message }

      if (sessionId) {
        body.session_id = sessionId
      }

      const data = await apiRequest('/chat', body)

      handleResult(data)

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

  function newChat() {
    if (inFlight.current) return

    setMessages([])
    setSessionId(null)
    setProposal(null)
    setInput('')
    setError('')
    setSidebarOpen(false)
  }

  function handleRenameSession(id, title) {
    renameSession(id, title)
    setMetaVersion(version => version + 1)
  }

  function handleDeleteSession(id) {
    hideSession(id)
    setMetaVersion(version => version + 1)

    if (id === sessionId) {
      newChat()
    }
  }

  const showEmpty = messages.length === 0 && !busy
  const showTyping = busy && messages.length > 0
  const inputBlocked = busy || Boolean(proposal)
  const sending = showTyping

  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#main-content">
        Skip to conversation
      </a>

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

          <section
            ref={chatScrollRef}
            className="chat-scroll"
            aria-label="Conversation"
            aria-busy={busy}
          >
            {showEmpty && (
              <EmptyState onSelectPrompt={prompt => setInput(prompt)} />
            )}

            {messages.length > 0 && (
              <MessageList
                messages={messages}
                showTyping={showTyping}
              />
            )}

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