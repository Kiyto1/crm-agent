import { useEffect, useRef } from 'react'
import Button from './Button'
import Icon from './Icon'

// Panel that slides in from the right. It is a NON-modal <dialog> (show()
// instead of showModal()), so the rest of the page stays usable. That is what
// lets you keep chatting with the assistant while a customer is open.
// The trade-off: no automatic Escape-to-close or focus trap, so we add Escape.
export default function Drawer({ open, onClose, title, subtitle, children }) {
  const dialogRef = useRef(null)
  const titleRef = useRef(null)

  // Keep the dialog in step with the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current

    if (open && !dialog.open) {
      dialog.show()
      titleRef.current?.focus() // move keyboard focus into the panel
    }

    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="drawer"
      aria-labelledby="drawer-title"
      onKeyDown={event => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div className="drawer__panel">
        <header className="drawer__header">
          <div>
            <h2
              className="drawer__title"
              id="drawer-title"
              ref={titleRef}
              tabIndex={-1}
            >
              {title}
            </h2>
            {subtitle && <p className="drawer__subtitle">{subtitle}</p>}
          </div>

          <Button
            variant="ghost"
            iconOnly
            aria-label="Close panel"
            onClick={onClose}
          >
            <Icon name="close" />
          </Button>
        </header>

        <div className="drawer__body">{children}</div>
      </div>
    </dialog>
  )
}
