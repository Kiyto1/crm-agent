import { useState } from 'react'
import AssistantPanel from './components/assistant/AssistantPanel'
import AppShell from './components/layout/AppShell'
import { useChat } from './hooks/useChat'
import { useRoute } from './hooks/useRoute'
import { useTheme } from './hooks/useTheme'
import ComingSoon from './pages/ComingSoon'
import CustomersPage from './pages/CustomersPage'
import OverviewPage from './pages/OverviewPage'
import TasksPage from './pages/TasksPage'

// App wires everything together: the page (route), the theme, the chat, and
// the assistant panel. useChat lives here, so the conversation survives page
// changes and is shared by the panel on every page.
export default function App() {
  const { route, param } = useRoute()
  const { theme, cycleTheme, label } = useTheme()
  const [assistantOpen, setAssistantOpen] = useState(false)

  // dataVersion goes up each time the assistant saves something. Pages pass it
  // to useApi, so they fetch again and show the change without a reload.
  const [dataVersion, setDataVersion] = useState(0)

  const chat = useChat({
    onDataChanged: () => setDataVersion(version => version + 1),
  })

  // The customer whose drawer is open (only on the Customers page).
  const customerId = route === 'customers' ? param : null

  return (
    <AppShell
      route={route}
      theme={theme}
      themeLabel={label}
      onCycleTheme={cycleTheme}
      assistantOpen={assistantOpen}
      onToggleAssistant={() => setAssistantOpen(open => !open)}
      panel={
        <AssistantPanel
          open={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          chat={chat}
          context={{ route, customerId }}
        />
      }
    >
      {route === 'overview' && <OverviewPage dataVersion={dataVersion} />}
      {route === 'customers' && (
        <CustomersPage param={param} dataVersion={dataVersion} />
      )}
      {route === 'tasks' && <TasksPage dataVersion={dataVersion} />}
      {route === 'deals' && <ComingSoon route={route} />}
    </AppShell>
  )
}
