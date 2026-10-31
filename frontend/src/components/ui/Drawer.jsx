import { useEffect, useRef } from 'react'
import Button from './Button'
import Icon from './Icon'

// Panel that slides in from the right. Like AboutDemo it uses the native
// <dialog>: showModal() gives focus trapping, Escape-to-close and a backdrop.
export default function Drawer({ open, onClose, title, subtitle, children }) {
  const dialogRef = useRef(null)

  // Keep the dialog in step with the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="drawer"
      aria-labelledby="drawer-title"
      onClose={onClose} // fires for Escape and for dialog.close()
      // The panel fills the dialog, so a click on the dialog itself is the backdrop.
      onClick={event => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className="drawer__panel">
        <header className="drawer__header">
          <div>
            <h2 className="drawer__title" id="drawer-title">
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
