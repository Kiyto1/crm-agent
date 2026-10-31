import { apiRequest } from '../api'

// Deal actions. The backend runs the same functions the assistant uses
// (deals.py), so the buttons and the assistant behave alike.

export function changeStage(customerId, stage) {
  return apiRequest(`/customers/${encodeURIComponent(customerId)}/stage`, {
    stage,
  })
}

export function logContact(customerId, channel, summary) {
  return apiRequest(
    `/customers/${encodeURIComponent(customerId)}/activities`,
    { channel, summary }
  )
}
