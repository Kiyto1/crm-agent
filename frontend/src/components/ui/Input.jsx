import { cx } from '../../utils/cx'

// Single-line text field. Pass an aria-label when there is no visible <label>.
export default function Input({ className, ...rest }) {
  return <input className={cx('input', className)} {...rest} />
}
