import { useEffect, useRef } from 'react'
import Button from '../ui/Button'
import Icon from '../ui/Icon'

// "About this demo" dialog. Uses the browser's native <dialog>:
// showModal() gives focus trapping, Escape-to-close and a backdrop for free.
export default function AboutDemo({ open, onClose }) {
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
      className="dialog"
      aria-labelledby="about-title"
      // Fires for Escape and for dialog.close(), so state never gets stuck.
      onClose={onClose}
      // Padding lives on the inner panel, so a click on the dialog
      // element itself can only be a click on the backdrop.
      onClick={event => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className="dialog__panel">
        <div className="dialog__header">
          <h2 className="dialog__title" id="about-title">
            About this demo
          </h2>

          <Button
            variant="ghost"
            iconOnly
            aria-label="Close"
            onClick={onClose}
          >
            <Icon name="close" />
          </Button>
        </div>

        <section className="dialog__section">
          <h3>What is this?</h3>
          <p>
            An AI CRM assistant that helps you find customers, explore
            business needs, save notes, and manage follow-up tasks through
            conversation. Database changes require your approval.
          </p>
        </section>

        <section className="dialog__section">
          <h3>About the CSV dataset</h3>
          <p>
            The demo starts with 120 fictional customer records from{' '}
            <code>saudi_crm_customers_synthetic.csv</code>. Each row
            represents a contact and includes their company, industry, job
            title, sales stage, business needs, recent interaction, and next
            follow-up.
          </p>
          <p>
            The CSV is imported into a SQLite database so the assistant can
            search customer records and check follow-up dates. Notes and
            tasks created during the demo are stored separately in the
            database; they do not change the original CSV.
          </p>
        </section>

        <section className="dialog__section">
          <h3>Demo disclaimer</h3>
          <p>
            This is a portfolio demonstration, not a production CRM. AI
            responses may contain mistakes. Review answers and proposed
            changes, and do not enter confidential information, passwords, or
            API keys.
          </p>
          <p>
            Free hosting may take about a minute to wake after inactivity.
            Saved chats and demo changes may reset when the server restarts.
            The first semantic search can take longer while the index is
            prepared. Usage limits apply.
          </p>
        </section>
      </div>
    </dialog>
  )
}
