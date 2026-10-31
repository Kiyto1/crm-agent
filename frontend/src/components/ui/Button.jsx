import { cx } from '../../utils/cx'

// One button for the whole app.
//   variant: 'primary' | 'secondary' | 'ghost'
//   size: 'md' | 'sm'
//   loading: shows a spinner and blocks clicks
//   iconOnly: square button (pass aria-label)
//   href: renders a link that looks like a button
export default function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  loading = false,
  iconOnly = false,
  className,
  children,
  disabled,
  href,
  ...rest
}) {
  const classes = cx(
    'btn',
    `btn--${variant}`,
    size === 'sm' && 'btn--sm',
    block && 'btn--block',
    iconOnly && 'btn--icon',
    loading && 'is-loading',
    className
  )

  if (href) {
    return (
      <a className={classes} href={href} {...rest}>
        {children}
      </a>
    )
  }

  return (
    <button
      type="button"
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}
