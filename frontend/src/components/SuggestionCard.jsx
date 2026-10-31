import Icon from './ui/Icon'

// One clickable starter. It only fills the message box; it never sends.
export default function SuggestionCard({
  icon,
  title,
  description,
  onClick,
  disabled,
}) {
  return (
    <button
      type="button"
      className="suggestion-card"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="suggestion-card__icon">
        <Icon name={icon} />
      </span>

      <span>
        <span className="suggestion-card__title">{title}</span>
        <span className="suggestion-card__desc">{description}</span>
      </span>
    </button>
  )
}
