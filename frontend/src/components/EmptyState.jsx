import { SUGGESTIONS } from '../constants/suggestions'
import SuggestionCard from './SuggestionCard'

export default function EmptyState({ onSelectPrompt }) {
  return (
    <div className="empty-state">
      <h2 className="empty-state__title">What would you like to work on?</h2>
      <p className="empty-state__lead">
        Search your CRM or ask for help with your next action.
      </p>

      <div className="empty-state__grid" role="list">
        {SUGGESTIONS.map(item => (
          <div key={item.id} role="listitem">
            <SuggestionCard
              icon={item.icon}
              title={item.title}
              description={item.description}
              onClick={() => onSelectPrompt(item.prompt)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
