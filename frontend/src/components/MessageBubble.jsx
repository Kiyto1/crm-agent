import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MessageBubble({ role, content }) {
  const isUser = role === 'user'

  return (
    <article className={`message-row ${role}`}>
      {!isUser && (
        <div className="message-avatar" aria-hidden="true">
          AI
        </div>
      )}

      <div className={`message-bubble ${role}`} dir="auto">
        <p className="message-bubble__label">
          {isUser ? 'You' : 'CRM Assistant'}
        </p>

        <div className="message-bubble__content markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </article>
  )
}
