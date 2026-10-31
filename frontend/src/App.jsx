import { useState } from 'react'
import AssistantPanel from './components/assistant/AssistantPanel'
import CustomerDrawer from './components/CustomerDrawer'
import AppShell from './components/layout/AppShell'
import { useChat } from './hooks/useChat'
import { useRoute } from './hooks/useRoute'
import { useTheme } from './hooks/useTheme'
import CustomersPage from './pages/CustomersPage'
import DealsPage from './pages/DealsPage'
import OverviewPage from './pages/OverviewPage'
import TasksPage from './pages/TasksPage'

// App wires everything together: the page (route), the theme, the chat, the
// assistant panel and the customer drawer. useChat lives here, so the
// conversation survives page changes and is shared by the panel everywhere.
export default function App() {
  const { route, param } = useRoute()
  const { theme, cycleTheme, label } = useTheme()
  const [assistantOpen, setAssistantOpen] = useState(false)

  // dataVersion goes up each time something is saved (by the assistant or by
  // a button). Pages pass it to useApi, so they fetch again and show the
  // change without a reload.
  const [dataVersion, setDataVersion] = useState(0)

  function dataChanged() {
    setDataVersion(version => version + 1)
  }

  const chat = useChat({ onDataChanged: dataChanged })

  // The customer drawer opens from #/customers/ID and #/deals/ID.
  const customerId =
    route === 'customers' || route === 'deals' ? param : null

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
      {route === 'customers' && <CustomersPage dataVersion={dataVersion} />}
      {route === 'deals' && <DealsPage dataVersion={dataVersion} />}
      {route === 'tasks' && <TasksPage dataVersion={dataVersion} />}

      <CustomerDrawer
        customerId={customerId}
        onClose={() => {
          window.location.hash = `#/${route}`
        }}
        dataVersion={dataVersion}
        onChanged={dataChanged}
      />
    </AppShell>
  )
}
