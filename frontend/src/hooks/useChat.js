import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../api'
import {
  hideSession,
  renameSession,
  visibleSessions,
} from '../utils/sessionMeta'

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

// All chat state and server calls live here (moved out of App.jsx).
// App creates one instance, so the conversation survives page changes
// and a later AI side panel can share it.
export function useChat() {
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

  // Trigger a render after locally renaming or hiding conversations.
  const [metaVersion, setMetaVersion] = useState(0)

  // A ref remembers a value without triggering renders.
  const inFlight = useRef(false)

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


  return {
    // state
    messages,
    sessions: displaySessions,
    input,
    sessionId,
    proposal,
    busy,
    error,
    metaVersion,

    // derived conditions
    showEmpty: messages.length === 0 && !busy,
    showTyping: busy && messages.length > 0,
    inputBlocked: busy || Boolean(proposal),

    // actions
    setInput,
    sendMessage,
    decideApproval,
    openSession,
    newChat,
    renameSession: handleRenameSession,
    deleteSession: handleDeleteSession,
  }
}
