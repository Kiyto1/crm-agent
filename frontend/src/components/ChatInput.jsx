import { useEffect, useRef } from 'react'
import Button from './ui/Button'

// Message box with auto-growing textarea and a Send button.
// Fully controlled by the parent: `value` and `onChange` come from useChat.
export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled, // block typing/sending (busy or waiting for approval)
  loading, // show the spinner on the button
  placeholder,
}) {
  const textareaRef = useRef(null)

  // Auto-resize: grow with the text, up to a max height of 160px
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return

    el.style.height = 'auto' // reset first so it can shrink
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  const canSend = !disabled && Boolean(value.trim())

  // Enter sends, Shift+Enter inserts a new line
  function handleKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return

    event.preventDefault()
    if (canSend && !loading) onSend()
  }

  return (
    <div className="chat-input-wrap">
      <form
        className="chat-input"
        onSubmit={event => {
          event.preventDefault() // stop the page from reloading
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
          dir="auto" // text direction follows the content (Arabic + English)
          onChange={event => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />

        <Button
          type="submit"
          variant="primary"
          className="chat-input__send"
          loading={loading}
          disabled={!canSend}
        >
          {loading ? 'Sending' : 'Send'}
        </Button>
      </form>

      <p className="chat-input-hint">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  )
}
