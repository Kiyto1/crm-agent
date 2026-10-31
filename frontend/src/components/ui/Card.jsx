import { cx } from '../../utils/cx'

// Bordered surface. Give it a title or action to get a header row.
export default function Card({ title, action, className, children }) {
  return (
    <section className={cx('card', className)}>
      {(title || action) && (
        <header className="card__header">
          {title && <h2 className="card__title">{title}</h2>}
          {action}
        </header>
      )}

      <div className="card__body">{children}</div>
    </section>
  )
}
