import MessageBubble from './MessageBubble'

export default function MessageList({ messages, showTyping, endRef }) {
  return (
    <div className="message-list">
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id || `${message.role}-${index}`}
          role={message.role}
          content={message.content}
        />
      ))}

      {showTyping && (
        <div className="typing-indicator" role="status" aria-live="polite">
          <div className="message-avatar" aria-hidden="true">
            AI
          </div>
          <div className="typing-indicator__bubble">
            <span className="typing-indicator__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="sr-only">Assistant is typing</span>
          </div>
        </div>
      )}

      <div ref={endRef} className="scroll-anchor" />
    </div>
  )
}
