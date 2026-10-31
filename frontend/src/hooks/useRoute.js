import { useEffect, useState } from 'react'
import { APP_NAME, DEFAULT_ROUTE, ROUTES } from '../routes'

// Hash routing: the page is chosen by the part after "#" in the URL.
//   /#/customers             -> route "customers"
//   /#/customers/CON-21066   -> route "customers", param "CON-21066"
// The param lets a link open one customer's detail drawer. Links are plain
// <a href="#/...">, the browser fires "hashchange", and no router library
// or server change is needed.
function readLocation() {
  const [name, param] = window.location.hash.replace(/^#\/?/, '').split('/')

  // Unknown hashes fall back to the default page.
  const known = ROUTES.some(route => route.id === name)

  return {
    route: known ? name : DEFAULT_ROUTE,
    param: known && param ? decodeURIComponent(param) : null,
  }
}

export function useRoute() {
  const [location, setLocation] = useState(readLocation)

  useEffect(() => {
    function onHashChange() {
      setLocation(readLocation())
    }

    window.addEventListener('hashchange', onHashChange)

    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Keep the browser tab title in step with the page.
  useEffect(() => {
    const current = ROUTES.find(item => item.id === location.route)

    document.title = `${current.label} · ${APP_NAME}`
  }, [location.route])

  return location
}
