import { useEffect, useRef } from 'react'

// Message box with auto-growing textarea and a Send button.
// Fully controlled by the parent: `value` and `onChange` come from App's `input` state.
export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled, // block typing/sending (busy or waiting for approval)
  loading, // show the "Sending" spinner on the button
  placeholder,
}) {
  const textareaRef = useRef(null) // the <textarea> DOM element

  // Auto-resize: grow with the text, up to a max height of 160px
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return

    el.style.height = 'auto' // reset first so it can shrink when text is deleted
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  // Enter sends, Shift+Enter inserts a new line
  function handleKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return

    event.preventDefault() // stop the new line from being inserted
    if (!disabled && !loading && value.trim()) {
      onSend()
    }
  }

  const hasText = Boolean(value.trim()) // ignore whitespace-only input
  const canSend = !disabled && hasText

  return (
    <div className="chat-input-wrap">
      <form
        className="chat-input"
        onSubmit={event => {
          event.preventDefault() // stop the page from reloading
          if (canSend && !loading) onSend()
        }}
      >
        {/* Label for screen readers only (visually hidden) */}
        <label className="sr-only" htmlFor="message">
          Your message
        </label>

        <textarea
          ref={textareaRef}
          id="message"
          name="message"
          rows={1}
          value={value}
          dir="auto" // text direction follows the content (good for Arabic + English)
          onChange={event => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />

        <button
          type="submit"
          className={loading ? 'btn btn--send is-loading' : 'btn btn--send'}
          disabled={!canSend && !loading} // stays enabled while loading so the spinner looks active
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