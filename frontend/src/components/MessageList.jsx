import MessageBubble from './MessageBubble'

// Renders the list of chat messages, plus the typing indicator while waiting.
export default function MessageList({ messages, showTyping, endRef }) {
  return (
    <div className="message-list">
      {/* One bubble per message */}
      {messages.map((message, index) => (
        <MessageBubble
          // Use the message id as the React key.
          // Fallback for messages without one (e.g. from the backend).
          key={message.id || `${message.role}-${index}`}
          role={message.role}
          content={message.content}
        />
      ))}

      {/* "Assistant is typing" indicator, shown while a request is running */}
      {showTyping && (
        // role="status" + aria-live: screen readers announce it politely
        <div className="typing-indicator" role="status" aria-live="polite">
          <div className="message-avatar" aria-hidden="true">
            AI
          </div>
          <div className="typing-indicator__bubble">
            {/* Three animated dots (the animation is done in CSS) */}
            <span className="typing-indicator__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            {/* Text for screen readers only (visually hidden) */}
            <span className="sr-only">Assistant is typing</span>
          </div>
        </div>
      )}

      {/* Empty element at the bottom, used as a scroll target via endRef */}
      <div ref={endRef} className="scroll-anchor" />
    </div>
  )
}