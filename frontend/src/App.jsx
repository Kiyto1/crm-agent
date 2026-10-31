import AppShell from './components/layout/AppShell'
import { useChat } from './hooks/useChat'
import { useRoute } from './hooks/useRoute'
import { useTheme } from './hooks/useTheme'
import AssistantPage from './pages/AssistantPage'
import ComingSoon from './pages/ComingSoon'
import CustomersPage from './pages/CustomersPage'
import OverviewPage from './pages/OverviewPage'
import TasksPage from './pages/TasksPage'

// App wires three things together: which page (route), the theme, and the
// chat state. useChat lives here, so the conversation survives page changes.
export default function App() {
  const { route, param } = useRoute()
  const { theme, cycleTheme, label } = useTheme()
  const chat = useChat()

  return (
    <AppShell
      route={route}
      theme={theme}
      themeLabel={label}
      onCycleTheme={cycleTheme}
    >
      {route === 'overview' && <OverviewPage />}
      {route === 'customers' && <CustomersPage param={param} />}
      {route === 'tasks' && <TasksPage />}
      {route === 'assistant' && <AssistantPage chat={chat} />}
      {route === 'deals' && <ComingSoon route={route} />}
    </AppShell>
  )
}
