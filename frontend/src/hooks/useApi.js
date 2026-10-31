import { useEffect, useState } from 'react'
import { apiRequest } from '../api'

// Loads data from a GET endpoint and tracks loading / error for the page.
//   const { data, loading, error, reload } = useApi('/overview')
// - Pass null as the endpoint to load nothing (for example a closed drawer).
// - keepPrevious: while a new request runs (for example after typing in a
//   filter), keep showing the old data instead of blanking the table.
// - reload() fetches again, which pages call after saving a change.
export function useApi(endpoint, { keepPrevious = false } = {}) {
  const [reloadCount, setReloadCount] = useState(0)

  // Every request gets a key. The stored result remembers which key it
  // answers, so an old, slow response can never overwrite a newer one.
  const key = endpoint ? `${endpoint}#${reloadCount}` : null
  const [result, setResult] = useState({
    key: null,
    endpoint: null,
    data: null,
    error: '',
  })

  useEffect(() => {
    if (!key) return

    let cancelled = false

    apiRequest(endpoint)
      .then(data => {
        if (!cancelled) setResult({ key, endpoint, data, error: '' })
      })
      .catch(error => {
        // Keep older data (if any) so a failed refresh does not blank the page.
        if (!cancelled) {
          setResult(previous => ({ ...previous, key, error: error.message }))
        }
      })

    // If the endpoint changes first, ignore this request's answer.
    return () => {
      cancelled = true
    }
  }, [key, endpoint])

  const sameEndpoint = result.endpoint === endpoint

  return {
    data: sameEndpoint || keepPrevious ? result.data : null,
    // Loading means "the newest request has not answered yet".
    loading: Boolean(key) && result.key !== key,
    error: result.key === key ? result.error : '',
    reload: () => setReloadCount(count => count + 1),
  }
}
