import { EmptyState } from '../components/ui/States'
import Button from '../components/ui/Button'
import { ROUTES } from '../routes'

// Honest placeholder for pages that are planned but not built yet.
export default function ComingSoon({ route }) {
  const page = ROUTES.find(item => item.id === route)

  return (
    <div className="page">
      <EmptyState
        icon={page.icon}
        title={`${page.label} is coming in phase ${page.phase}`}
        action={
          <Button variant="primary" href="#/assistant">
            Open the assistant
          </Button>
        }
      >
        {page.blurb}
      </EmptyState>
    </div>
  )
}
