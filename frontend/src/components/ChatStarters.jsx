import SuggestionCard from './SuggestionCard'

// Shown in an empty conversation so visitors never face a blank box.
// `starters` come from getStarters() and depend on the current page.
export default function ChatStarters({ starters, onSelectPrompt, disabled }) {
  return (
    <div className="starters">
      <h2 className="starters__title">How can I help?</h2>
      <p className="starters__lead">
        Pick a suggestion to fill the message box, then press send. Changes
        are only saved after you approve them.
      </p>

      <div className="starters__grid" role="list">
        {starters.map(item => (
          <div key={item.id} role="listitem">
            <SuggestionCard
              icon={item.icon}
              title={item.title}
              description={item.description}
              disabled={disabled}
              onClick={() => onSelectPrompt(item.prompt)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
