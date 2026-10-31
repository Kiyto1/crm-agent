import { useEffect, useRef } from 'react'
import { AUTHOR } from '../../constants/author'
import Button from '../ui/Button'
import Icon from '../ui/Icon'

// What the visitor can do, one line each, written for a sales rep.
const FEATURES = [
  {
    icon: 'dashboard',
    title: 'Start your day on the Overview',
    text: 'See your pipeline value, overdue follow-ups and the customers who need attention.',
  },
  {
    icon: 'users',
    title: 'Work your customers and deals',
    text: 'Open a customer to move the deal to the next stage or log a call, email or meeting.',
  },
  {
    icon: 'tasks',
    title: 'Stay on top of follow-ups',
    text: 'Create, complete and reschedule tasks so no deal goes quiet.',
  },
  {
    icon: 'sparkle',
    title: 'Let the assistant help',
    text: 'Click Assistant (top right) and ask in plain language. Nothing is saved until you approve it.',
  },
]

// Short welcome shown the first time the app opens.
// Same native <dialog> pattern as AboutDemo.
export default function WelcomeDialog({ open, onClose, onLearnMore }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="welcome-title"
      onClose={onClose}
      onClick={event => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className="dialog__panel">
        <div className="dialog__header">
          <h2 className="dialog__title" id="welcome-title">
            Welcome to CRM Workspace
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

        <p className="welcome__intro">
          <strong>You are a salesperson.</strong> This CRM holds your 120
          customers and their deals (all fictional). Use the dashboard and the
          AI assistant to decide who to follow up with today and keep every
          deal moving.
        </p>

        <ul className="welcome__list">
          {FEATURES.map(item => (
            <li key={item.title} className="welcome__item">
              <span className="welcome__icon" aria-hidden="true">
                <Icon name={item.icon} size={18} />
              </span>

              <div>
                <p className="welcome__title">{item.title}</p>
                <p className="welcome__text">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="welcome__try">
          Try asking the assistant:{' '}
          <em>Which open deals have had no contact for 30 days?</em>
        </p>

        <div className="welcome__author">
          <span className="welcome__avatar" aria-hidden="true">
            {AUTHOR.name[0]}
          </span>

          <div>
            <p className="welcome__title">
              Built by {AUTHOR.name} · {AUTHOR.role}
            </p>
            <p className="welcome__text">{AUTHOR.status}</p>
          </div>
        </div>

        <div className="welcome__actions">
          <Button variant="primary" onClick={onClose}>
            Get started
          </Button>

          <Button variant="ghost" onClick={onLearnMore}>
            More about this demo
          </Button>
        </div>
      </div>
    </dialog>
  )
}