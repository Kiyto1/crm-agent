import { cx } from '../../utils/cx'

// Small status label. tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
export default function Badge({ tone = 'neutral', className, children }) {
  return (
    <span className={cx('badge', tone !== 'neutral' && `badge--${tone}`, className)}>
      {children}
    </span>
  )
}
