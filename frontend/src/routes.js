// Single source of truth for navigation.
// The sidebar, page title and router all read this list.
// ready: false shows a "coming soon" page until that phase is built.
export const APP_NAME = 'CRM Workspace'

export const ROUTES = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'dashboard',
    ready: true,
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: 'users',
    ready: true,
  },
  {
    id: 'deals',
    label: 'Deals',
    icon: 'deals',
    ready: false,
    phase: 4,
    blurb: 'Sales stages, deal values, progress updates and stalled opportunities.',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: 'tasks',
    ready: true,
  },
  { id: 'assistant', label: 'Assistant', icon: 'sparkle', ready: true },
]

// Where visitors land.
export const DEFAULT_ROUTE = 'overview'
