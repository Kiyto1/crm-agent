import { cx } from '../../utils/cx'

// One big number with a label and a short explanation underneath.
// tone: 'neutral' | 'danger' | 'warning' | 'success' colors the number.
export default function StatCard({ label, value, hint, tone = 'neutral', href }) {
  const content = (
    <>
      <p className="stat-card__label">{label}</p>
      <p className={cx('stat-card__value', `stat-card__value--${tone}`)}>
        {value}
      </p>
      {hint && <p className="stat-card__hint">{hint}</p>}
    </>
  )

  // With an href the whole card is a link.
  return href ? (
    <a className="card stat-card stat-card--link" href={href}>
      {content}
    </a>
  ) : (
    <div className="card stat-card">{content}</div>
  )
}
