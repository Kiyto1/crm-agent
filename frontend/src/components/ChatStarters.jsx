import { SUGGESTIONS } from '../constants/suggestions'
import SuggestionCard from './SuggestionCard'

// Shown in an empty conversation so visitors never face a blank box.
export default function ChatStarters({ onSelectPrompt, disabled }) {
  return (
    <div className="starters">
      <h2 className="starters__title">What would you like to work on?</h2>
      <p className="starters__lead">
        Pick a starter to fill the message box, then press send. Changes are
        only saved after you approve them.
      </p>

      <div className="starters__grid" role="list">
        {SUGGESTIONS.map(item => (
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
