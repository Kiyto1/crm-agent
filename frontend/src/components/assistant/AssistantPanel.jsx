import { useEffect, useRef, useState } from 'react'
import { getStarters } from '../../constants/suggestions'
import ApprovalPanel from '../ApprovalPanel'
import ChatInput from '../ChatInput'
import ChatStarters from '../ChatStarters'
import ConversationList from '../ConversationList'
import MessageList from '../MessageList'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { Alert } from '../ui/States'

// The AI assistant, docked on the right of every page.
// All chat state comes from useChat (in App), so the conversation is the same
// on every page and survives opening and closing the panel.
//   context: { route, customerId } tells the panel what the user is looking at.
export default function AssistantPanel({ open, onClose, chat, context }) {
  const [view, setView] = useState('chat') // 'chat' or 'history'
  const scrollRef = useRef(null)

  const { messages, proposal, error, notice, busy } = chat

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current
    if (el && messages.length > 0) el.scrollTop = el.scrollHeight
  }, [open, view, messages.length, proposal, busy])

  if (!open) return null

  return (
    <>
      {/* On narrow screens the panel floats over the page; this dims it. */}
      <button
        type="button"
        className="panel-backdrop"
        aria-label="Close assistant"
        onClick={onClose}
      />

      <aside
        id="assistant-panel"
        className="assistant-panel"
        aria-label="AI assistant"
      >
        <header className="assistant-panel__header">
          <h2 className="assistant-panel__title">
            <Icon name="sparkle" size={18} />
            Assistant
          </h2>

          <div className="assistant-panel__tools">
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={view === 'history'}
              onClick={() => setView(view === 'history' ? 'chat' : 'history')}
            >
              <Icon name="history" size={16} />
              Chats
            </Button>

            <Button
              variant="ghost"
              iconOnly
              aria-label="New chat"
              title="New chat"
              disabled={busy}
              onClick={() => {
                chat.newChat()
                setView('chat')
              }}
            >
              <Icon name="plus" />
            </Button>

            <Button
              variant="ghost"
              iconOnly
              aria-label="Close assistant"
              onClick={onClose}
            >
              <Icon name="close" />
            </Button>
          </div>
        </header>

        {context.customerId && (
          <p className="assistant-panel__context">
            Looking at <Badge tone="info">{context.customerId}</Badge>
          </p>
        )}

        {view === 'history' ? (
          <div className="assistant-panel__body">
            <ConversationList
              metaTick={chat.metaVersion}
              sessions={chat.sessions}
              sessionId={chat.sessionId}
              busy={busy}
              onNewChat={() => {
                chat.newChat()
                setView('chat')
              }}
              onOpenSession={id => {
                chat.openSession(id)
                setView('chat')
              }}
              onRenameSession={chat.renameSession}
              onDeleteSession={chat.deleteSession}
            />
          </div>
        ) : (
          <>
            <section
              ref={scrollRef}
              className="assistant-panel__body"
              aria-label="Conversation"
              aria-busy={busy}
            >
              {chat.showEmpty && (
                <ChatStarters
                  starters={getStarters(context)}
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

              {notice && <Alert tone="success">{notice}</Alert>}
              {error && <Alert tone="danger">{error}</Alert>}
            </section>

            <footer className="assistant-panel__footer">
              <ChatInput
                value={chat.input}
                onChange={chat.setInput}
                onSend={chat.sendMessage}
                disabled={chat.inputBlocked}
                loading={chat.showTyping}
                placeholder={
                  proposal
                    ? 'Approve or reject above…'
                    : 'Ask your CRM assistant…'
                }
              />
            </footer>
          </>
        )}
      </aside>
    </>
  )
}
