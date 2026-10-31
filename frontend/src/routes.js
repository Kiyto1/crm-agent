// Single source of truth for navigation.
// The sidebar, page title and router all read this list.
export const APP_NAME = 'CRM Workspace'

export const ROUTES = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'customers', label: 'Customers', icon: 'users' },
  { id: 'deals', label: 'Deals', icon: 'deals' },
  { id: 'tasks', label: 'Tasks', icon: 'tasks' },
]

// Where visitors land.
export const DEFAULT_ROUTE = 'overview'
