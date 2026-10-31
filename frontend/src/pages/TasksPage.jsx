import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { completeTask, rescheduleTask } from '../services/tasksApi'
import { formatDate } from '../utils/format'
import TaskForm from '../components/TaskForm'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Icon from '../components/ui/Icon'
import Input from '../components/ui/Input'
import {
  Alert,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/ui/States'

// Tab name -> the ?status= value sent to the server ('' means all).
const FILTERS = [
  { label: 'Open', status: 'Open' },
  { label: 'Completed', status: 'Completed' },
  { label: 'All', status: '' },
]

export default function TasksPage() {
  const [status, setStatus] = useState('Open')
  const [showForm, setShowForm] = useState(false)

  // Which row is being rescheduled, and the date typed so far.
  const [editingId, setEditingId] = useState(null)
  const [draftDate, setDraftDate] = useState('')

  const [busyTaskId, setBusyTaskId] = useState(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  const list = useApi(`/tasks?status=${status}`, { keepPrevious: true })

  // The customer dropdown is only needed while the form is open.
  const customers = useApi(showForm ? '/customers' : null)

  const items = list.data?.items
  const today = list.data?.as_of

  // Run one task action, then refresh the list and show the result.
  async function runAction(task, action, successMessage) {
    setBusyTaskId(task.task_id)
    setNotice('')
    setActionError('')

    try {
      await action()
      setNotice(successMessage)
      setEditingId(null)
      list.reload()
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setBusyTaskId(null)
    }
  }

  function handleCreated(task) {
    setShowForm(false)
    setNotice(`Task added: “${task.title}”, due ${formatDate(task.due_date)}.`)
    list.reload()
  }

  function startReschedule(task) {
    setEditingId(task.task_id)
    setDraftDate(task.due_date)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filter tasks">
          {FILTERS.map(filter => (
            <button
              key={filter.label}
              type="button"
              className="segmented__button"
              aria-pressed={status === filter.status}
              onClick={() => setStatus(filter.status)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {!showForm && list.data && (
          <Button
            variant="primary"
            className="toolbar__end"
            onClick={() => setShowForm(true)}
          >
            <Icon name="plus" size={16} />
            New task
          </Button>
        )}
      </div>

      {showForm && today && (
        <Card title="New task">
          {customers.error && (
            <ErrorState message={customers.error} onRetry={customers.reload} />
          )}

          {customers.loading && <LoadingState>Loading customers…</LoadingState>}

          {customers.data && (
            <TaskForm
              today={today}
              customers={customers.data.items}
              onCreated={handleCreated}
              onCancel={() => setShowForm(false)}
            />
          )}
        </Card>
      )}

      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}

      {!items && !list.error && <LoadingState>Loading tasks…</LoadingState>}

      {items && items.length === 0 && (
        <EmptyState
          icon="tasks"
          title={status === 'Completed' ? 'No completed tasks yet' : 'No tasks here'}
        >
          Add a follow-up with “New task”, or ask the assistant to create one.
        </EmptyState>
      )}

      {items && items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Customer</th>
                <th scope="col">Due</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {items.map(task => {
                const open = task.status === 'Open'
                const editing = editingId === task.task_id
                const busy = busyTaskId === task.task_id

                return (
                  <tr key={task.task_id}>
                    <td>
                      <span className="table__strong" dir="auto">
                        {task.title}
                      </span>
                    </td>
                    <td>
                      <a className="link" href={`#/customers/${task.customer_id}`}>
                        {task.full_name}
                      </a>
                      <span className="table__sub">{task.company_name}</span>
                    </td>
                    <td>
                      {editing ? (
                        <Input
                          type="date"
                          value={draftDate}
                          onChange={event => setDraftDate(event.target.value)}
                          aria-label={`New due date for ${task.title}`}
                        />
                      ) : (
                        <>
                          {formatDate(task.due_date)}
                          {open && task.due_date < today && (
                            <Badge tone="danger">Overdue</Badge>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      <Badge tone={open ? 'warning' : 'success'}>
                        {task.status}
                      </Badge>
                    </td>
                    <td>
                      {open && !editing && (
                        <div className="table__actions">
                          <Button
                            size="sm"
                            loading={busy}
                            onClick={() =>
                              runAction(
                                task,
                                () => completeTask(task.task_id),
                                `Task completed: “${task.title}”.`
                              )
                            }
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startReschedule(task)}
                          >
                            Reschedule
                          </Button>
                        </div>
                      )}

                      {editing && (
                        <div className="table__actions">
                          <Button
                            size="sm"
                            variant="primary"
                            loading={busy}
                            disabled={!draftDate}
                            onClick={() =>
                              runAction(
                                task,
                                () => rescheduleTask(task.task_id, draftDate),
                                `Task moved to ${formatDate(draftDate)}.`
                              )
                            }
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
