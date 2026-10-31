import { useEffect, useRef, useState } from 'react'
import ApprovalPanel from '../components/ApprovalPanel'
import ChatInput from '../components/ChatInput'
import ChatStarters from '../components/ChatStarters'
import ConversationList from '../components/ConversationList'
import MessageList from '../components/MessageList'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import { Alert } from '../components/ui/States'

// The chat screen. All chat state comes in as `chat` (from useChat in App),
// so this component only decides what to show.
export default function AssistantPage({ chat }) {
  const [historyOpen, setHistoryOpen] = useState(false) // drawer on mobile
  const scrollRef = useRef(null)

  const { messages, proposal, error, busy } = chat

  // Keep the newest message in view (not needed for the empty starter view).
  useEffect(() => {
    const el = scrollRef.current
    if (el && messages.length > 0) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages.length, proposal, busy])

  return (
    <div className="assistant">
      {historyOpen && (
        <button
          type="button"
          className="conversations-backdrop"
          aria-label="Close conversation list"
          onClick={() => setHistoryOpen(false)}
        />
      )}

      <ConversationList
        metaTick={chat.metaVersion}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        sessions={chat.sessions}
        sessionId={chat.sessionId}
        busy={busy}
        onNewChat={chat.newChat}
        onOpenSession={chat.openSession}
        onRenameSession={chat.renameSession}
        onDeleteSession={chat.deleteSession}
      />

      <div className="assistant__main">
        <div className="assistant__column">
          <div className="assistant__toolbar">
            <Button
              className="assistant__history-btn"
              variant="secondary"
              size="sm"
              aria-expanded={historyOpen}
              aria-controls="conversation-list"
              onClick={() => setHistoryOpen(open => !open)}
            >
              <Icon name="history" size={16} />
              Chats
            </Button>
          </div>

          <section
            ref={scrollRef}
            className="assistant__scroll"
            aria-label="Conversation"
            aria-busy={busy}
          >
            {chat.showEmpty && (
              <ChatStarters
                onSelectPrompt={chat.setInput}
                disabled={chat.inputBlocked}
              />
            )}

            {messages.length > 0 && (
              <MessageList messages={messages} showTyping={chat.showTyping} />
            )}

            {/* Proposed changes stay here until approved or rejected. */}
            <ApprovalPanel
              proposal={proposal}
              busy={busy}
              onApprove={() => chat.decideApproval(true)}
              onReject={() => chat.decideApproval(false)}
            />

            {error && <Alert tone="danger">{error}</Alert>}
          </section>

          <ChatInput
            value={chat.input}
            onChange={chat.setInput}
            onSend={chat.sendMessage}
            disabled={chat.inputBlocked}
            loading={chat.showTyping}
            placeholder={
              proposal
                ? 'Review the proposed changes above…'
                : 'Ask your CRM assistant…'
            }
          />

          <p className="assistant__footnote">
            Changes require your approval. Saved chats can be reopened.
          </p>
        </div>
      </div>
    </div>
  )
}
