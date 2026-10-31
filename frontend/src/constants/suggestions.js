// Starter cards shown in an empty conversation.
// Clicking a card fills the message box with `prompt`; it never sends by itself.
// The prompts match the demo dataset (CON-21066 is Ahmed Almutairi).
export const SUGGESTIONS = [
  {
    id: 'explore',
    icon: 'users',
    title: 'Explore a customer',
    description: 'Look up a contact and see their full record.',
    prompt: 'Find Ahmed Almutairi and show his details.',
  },
  {
    id: 'note',
    icon: 'notes',
    title: 'Save a note',
    description: 'Ask for a change, then review it before it is saved.',
    prompt: 'Save a note for CON-21066: Ahmed requested onboarding support.',
  },
  {
    id: 'search',
    icon: 'search',
    title: 'Search by meaning',
    description: 'Find customers by need, with the source IDs.',
    prompt: 'Which customer requested onboarding support? Include the source ID.',
  },
  {
    id: 'task',
    icon: 'tasks',
    title: 'Create a follow-up task',
    description: 'The assistant proposes it; you approve it.',
    prompt: 'Create a task for CON-21066 titled Send revised proposal, due tomorrow.',
  },
]
