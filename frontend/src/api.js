// Support both GET requests and POST requests through Vite's proxy.
export async function apiRequest(endpoint, body) {
  let response

  try {
    response = await fetch(`/api${endpoint}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new Error(
      'Cannot reach the backend. Check that FastAPI is running.'
    )
  }

  let data

  try {
    data = await response.json()
  } catch {
    throw new Error(
      'The API returned an invalid response. Check the backend terminal.'
    )
  }

  if (!response.ok) {
    const detail = data.detail
    const error = new Error(
      typeof detail === 'string'
        ? detail
        : detail?.message || JSON.stringify(detail || 'Request failed.')
    )

    error.status = response.status
    throw error
  }

  return data
}
