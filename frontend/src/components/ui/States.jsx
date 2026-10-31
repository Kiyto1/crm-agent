import { cx } from '../../utils/cx'
import Button from './Button'
import Icon from './Icon'

// Friendly placeholder for a page or list with nothing to show.
export function EmptyState({ icon, title, children, action }) {
  return (
    <div className="empty-state">
      {icon && (
        <div className="empty-state__icon">
          <Icon name={icon} size={24} />
        </div>
      )}

      <h2 className="empty-state__title">{title}</h2>

      {children && <p className="empty-state__text">{children}</p>}

      {action && <div className="empty-state__action">{action}</div>}
    </div>
  )
}

// Message box. tone: 'danger' | 'warning' | 'success' | 'info'
// role="alert" makes screen readers announce it when it appears.
export function Alert({ tone = 'danger', className, children }) {
  return (
    <div className={cx('alert', `alert--${tone}`, className)} role="alert">
      {children}
    </div>
  )
}

// Shown while a page waits for the server.
export function LoadingState({ children = 'Loading…' }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" aria-hidden="true" />
      {children}
    </div>
  )
}

// A failed request, with a button to try again.
export function ErrorState({ message, onRetry }) {
  return (
    <Alert tone="danger" className="error-state">
      <span>{message}</span>

      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Alert>
  )
}
