import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { completeTask } from '../services/tasksApi'
import { daysBetween, formatDate, formatMoney } from '../utils/format'
import { isOpenStage } from '../constants/stages'
import StageBadge from './StageBadge'
import TaskForm from './TaskForm'
import Badge from './ui/Badge'
import Button from './ui/Button'
import Drawer from './ui/Drawer'
import Icon from './ui/Icon'
import { Alert, ErrorState, LoadingState } from './ui/States'

// Detail panel for one customer: company info, needs, notes, deal and tasks.
// It loads GET /customers/{id}, which returns the contact, notes and tasks.
export default function CustomerDrawer({ customerId, onClose, dataVersion }) {
  const { data, loading, error, reload } = useApi(
    customerId ? `/customers/${encodeURIComponent(customerId)}` : null,
    { refreshKey: dataVersion }
  )

  const contact = data?.contact

  return (
    <Drawer
      open={Boolean(customerId)}
      onClose={onClose}
      title={contact ? contact.full_name : 'Customer'}
      subtitle={
        contact
          ? `${contact.job_title} · ${contact.company_name}`
          : customerId
      }
    >
      {loading && !data && <LoadingState>Loading customer…</LoadingState>}

      {error && <ErrorState message={error} onRetry={reload} />}

      {/* key resets the form and messages when another customer is opened */}
      {data && <CustomerBody key={customerId} data={data} reload={reload} />}
    </Drawer>
  )
}

function CustomerBody({ data, reload }) {
  const { contact, notes, tasks, as_of: today } = data

  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyTaskId, setBusyTaskId] = useState(null)

  const open = isOpenStage(contact.deal_stage)
  const overdueDays =
    open && contact.next_followup_date && contact.next_followup_date < today
      ? daysBetween(contact.next_followup_date, today)
      : 0

  function handleCreated(task) {
    setShowForm(false)
    setNotice(`Task added: “${task.title}”, due ${formatDate(task.due_date)}.`)
    reload() // fetch the customer again so the new task appears
  }

  async function handleComplete(task) {
    setBusyTaskId(task.task_id)
    setActionError('')
    setNotice('')

    try {
      await completeTask(task.task_id)
      setNotice(`Task completed: “${task.title}”.`)
      reload()
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setBusyTaskId(null)
    }
  }

  return (
    <div className="customer">
      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}

      <section className="customer__section">
        <div className="customer__badges">
          <StageBadge stage={contact.deal_stage} />
          <Badge>{contact.customer_status}</Badge>
        </div>

        <dl className="facts">
          <Fact label="Deal value" value={formatMoney(contact.deal_value_sar)} />
          <Fact label="Owner" value={contact.assigned_owner} />
          <Fact label="Industry" value={contact.industry} />
          <Fact label="Company size" value={contact.company_size} />
          <Fact label="Location" value={[contact.city, contact.country].filter(Boolean).join(', ')} />
          <Fact label="Email" value={contact.email} />
          <Fact label="Interested in" value={contact.product_interest} />
          <Fact label="Estimated users" value={contact.estimated_users} />
        </dl>
      </section>

      <section className="customer__section">
        <h3>Business need</h3>
        <p>{contact.business_need || 'No business need recorded.'}</p>
      </section>

      <section className="customer__section">
        <h3>Last contact</h3>
        <p className="muted">
          {formatDate(contact.last_contact_date)}
          {contact.last_contact_channel && ` · ${contact.last_contact_channel}`}
        </p>
        <p>{contact.last_interaction_summary || 'No interaction summary.'}</p>
      </section>

      <section className="customer__section">
        <h3>Planned next step</h3>
        <p>{contact.next_action || 'Nothing planned.'}</p>
        {contact.next_followup_date && (
          <p className="muted">
            Follow-up {formatDate(contact.next_followup_date)}{' '}
            {overdueDays > 0 && (
              <Badge tone="danger">Overdue by {overdueDays} days</Badge>
            )}
          </p>
        )}
      </section>

      <section className="customer__section">
        <div className="customer__section-head">
          <h3>Tasks</h3>

          {!showForm && (
            <Button size="sm" variant="primary" onClick={() => setShowForm(true)}>
              <Icon name="plus" size={14} />
              Add follow-up
            </Button>
          )}
        </div>

        {showForm && (
          <TaskForm
            today={today}
            customerId={contact.customer_id}
            onCreated={handleCreated}
            onCancel={() => setShowForm(false)}
          />
        )}

        {tasks.length === 0 ? (
          <p className="muted">No tasks yet.</p>
        ) : (
          <ul className="item-list">
            {tasks.map(task => (
              <li key={task.task_id} className="item-list__row">
                <div>
                  <p className="item-list__title">{task.title}</p>
                  <p className="muted">
                    Due {formatDate(task.due_date)}{' '}
                    {task.status === 'Open' && task.due_date < today && (
                      <Badge tone="danger">Overdue</Badge>
                    )}
                  </p>
                </div>

                {task.status === 'Open' ? (
                  <Button
                    size="sm"
                    loading={busyTaskId === task.task_id}
                    onClick={() => handleComplete(task)}
                  >
                    Complete
                  </Button>
                ) : (
                  <Badge tone="success">Completed</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="customer__section">
        <h3>Notes</h3>

        {notes.length === 0 ? (
          <p className="muted">No notes yet.</p>
        ) : (
          <ul className="item-list">
            {notes.map(note => (
              <li key={note.note_id} className="item-list__row">
                <div>
                  <p className="item-list__title" dir="auto">
                    {note.content}
                  </p>
                  <p className="muted">{formatDate(note.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// One label/value pair. Empty values are skipped.
function Fact({ label, value }) {
  if (value == null || value === '') return null

  return (
    <div className="facts__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
