import { useEffect, useRef } from 'react'

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  loading,
  placeholder,
}) {
  const textareaRef = useRef(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return

    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  function handleKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return

    event.preventDefault()
    if (!disabled && !loading && value.trim()) {
      onSend()
    }
  }

  const hasText = Boolean(value.trim())
  const canSend = !disabled && hasText

  return (
    <div className="chat-input-wrap">
      <form
        className="chat-input"
        onSubmit={event => {
          event.preventDefault()
          if (canSend && !loading) onSend()
        }}
      >
        <label className="sr-only" htmlFor="message">
          Your message
        </label>

        <textarea
          ref={textareaRef}
          id="message"
          name="message"
          rows={1}
          value={value}
          dir="auto"
          onChange={event => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />

        <button
          type="submit"
          className={loading ? 'btn btn--send is-loading' : 'btn btn--send'}
          disabled={!canSend && !loading}
          aria-busy={loading || undefined}
        >
          {loading ? (
            <>
              <span className="btn-spinner" aria-hidden="true" />
              <span>Sending</span>
            </>
          ) : (
            'Send'
          )}
        </button>
      </form>

      <p className="chat-input-hint">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  )
}
