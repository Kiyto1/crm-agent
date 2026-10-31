import { apiRequest } from '../api'

// The three task actions. The pages use these, and the backend runs the same
// functions the assistant uses (crm_tools.py), so both paths behave alike.

export function createTask({ customerId, title, dueDate }) {
  return apiRequest('/tasks', {
    customer_id: customerId,
    title,
    due_date: dueDate,
  })
}

export function completeTask(taskId) {
  return apiRequest(`/tasks/${taskId}/complete`, {})
}

export function rescheduleTask(taskId, dueDate) {
  return apiRequest(`/tasks/${taskId}/reschedule`, { due_date: dueDate })
}
