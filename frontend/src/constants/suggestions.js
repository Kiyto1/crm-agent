// Starter suggestions shown in the empty chat state.
// Each item becomes a clickable card; clicking it fills the input with `prompt`.
export const SUGGESTIONS = [
  {
    id: 'contacts', // unique id (used as the React key)
    icon: 'users', // icon name the UI component maps to an SVG
    title: 'Find contacts', // card heading
    description: 'Search your CRM by name or company.', // short helper text
    prompt: 'Find contacts named Ahmed', // text placed in the input when clicked
  },
  {
    id: 'notes',
    icon: 'notes',
    title: 'Browse notes',
    description: 'See what the team has saved recently.',
    prompt: 'What saved notes do we have?',
  },
  {
    id: 'tasks',
    icon: 'tasks',
    title: 'Customer tasks',
    description: 'Open follow-ups for a specific account.',
    prompt: 'Show tasks for customer CON-21066',
  },
]