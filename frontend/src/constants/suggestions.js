// Suggested prompts shown in an empty conversation.
// Clicking one fills the message box; it never sends by itself.
// The prompts match the demo data, and they change with the page you are on.

// Always available.
const GENERAL = [
  {
    id: 'stalled',
    icon: 'deals',
    title: 'Find stalled deals',
    description: 'Open deals with no contact for 30 days.',
    prompt: 'Which open deals have had no contact for 30 days?',
  },
  {
    id: 'overdue',
    icon: 'tasks',
    title: 'Overdue follow-ups',
    description: 'What is late and who owns it.',
    prompt: 'Show my overdue follow-ups.',
  },
  {
    id: 'search',
    icon: 'search',
    title: 'Search by meaning',
    description: 'Find customers by need, with source IDs.',
    prompt: 'Which customer requested onboarding support? Include the source ID.',
  },
  {
    id: 'explore',
    icon: 'users',
    title: 'Explore a customer',
    description: 'Look up a contact and their record.',
    prompt: 'Find Ahmed Almutairi and show his details.',
  },
]

// Shown when a customer's detail drawer is open: they refer to that customer.
function forCustomer(id) {
  return [
    {
      id: 'summary',
      icon: 'users',
      title: 'Summarize this customer',
      description: 'Details, notes and tasks in one answer.',
      prompt: `Show the details, notes and tasks for ${id}.`,
    },
    {
      id: 'task',
      icon: 'tasks',
      title: 'Create a follow-up task',
      description: 'The assistant proposes it; you approve it.',
      prompt: `Create a task for ${id} titled "Follow up on proposal", due in 3 days.`,
    },
    {
      id: 'note',
      icon: 'notes',
      title: 'Save a note',
      description: 'Finish the sentence, then review before saving.',
      prompt: `Save a note for ${id}: `,
    },
    GENERAL[0],
  ]
}

// context: { route, customerId } from App.
export function getStarters({ route, customerId }) {
  if (customerId) return forCustomer(customerId)

  if (route === 'tasks') {
    return [
      GENERAL[1],
      {
        id: 'new-task',
        icon: 'plus',
        title: 'Create a task',
        description: 'Name the customer, title and due date.',
        prompt: 'Create a task for CON-21066 titled Send revised proposal, due tomorrow.',
      },
      GENERAL[0],
      GENERAL[2],
    ]
  }

  return GENERAL
}
