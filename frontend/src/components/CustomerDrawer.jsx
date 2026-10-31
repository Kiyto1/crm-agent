import { useState } from 'react'
import { isOpenStage, STAGE_ORDER, STAGES } from '../constants/stages'
import { useApi } from '../hooks/useApi'
import { changeStage } from '../services/dealsApi'
import { completeTask } from '../services/tasksApi'
import { daysBetween, formatDate, formatMoney } from '../utils/format'
import ContactForm from './ContactForm'
import StageBadge from './StageBadge'
import StageProgress from './StageProgress'
import TaskForm from './TaskForm'
import Badge from './ui/Badge'
import Button from './ui/Button'
import Drawer from './ui/Drawer'
import Icon from './ui/Icon'
import { Alert, ErrorState, LoadingState } from './ui/States'

// Detail panel for one customer: company info, deal, tasks, notes, activity.
// It loads GET /customers/{id}. After any change it calls onChanged(), which
// makes App refresh every page (including this drawer) with new data.
export default function CustomerDrawer({
  customerId,
  onClose,
  dataVersion,
  onChanged,
}) {
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

      {/* key resets the forms and messages when another customer is opened */}
      {data && (
        <CustomerBody key={customerId} data={data} onChanged={onChanged} />
      )}
    </Drawer>
  )
}

function CustomerBody({ data, onChanged }) {
  const { contact, notes, tasks, activities, as_of: today } = data

  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showContactForm, setShowContactForm] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyTaskId, setBusyTaskId] = useState(null)

  // The stage picked in the dropdown (not saved until "Update stage").
  const [newStage, setNewStage] = useState(contact.deal_stage)
  const [savingStage, setSavingStage] = useState(false)

  const open = isOpenStage(contact.deal_stage)
  const overdueDays =
    open && contact.next_followup_date && contact.next_followup_date < today
      ? daysBetween(contact.next_followup_date, today)
      : 0

  function handleCreated(task) {
    setShowTaskForm(false)
    setNotice(`Task added: “${task.title}”, due ${formatDate(task.due_date)}.`)
    onChanged()
  }

  function handleLogged() {
    setShowContactForm(false)
    setNotice('Contact logged.')
    onChanged()
  }

  async function handleComplete(task) {
    setBusyTaskId(task.task_id)
    setActionError('')
    setNotice('')

    try {
      await completeTask(task.task_id)
      setNotice(`Task completed: “${task.title}”.`)
      onChanged()
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setBusyTaskId(null)
    }
  }

  async function handleStage() {
    setSavingStage(true)
    setActionError('')
    setNotice('')

    try {
      await changeStage(contact.customer_id, newStage)
      setNotice(`Stage changed to ${STAGES[newStage].label}.`)
      onChanged()
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setSavingStage(false)
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
        <h3>Deal progress</h3>
        <StageProgress stage={contact.deal_stage} />

        <div className="deal-box">
          <select
            className="select"
            value={newStage}
            onChange={event => setNewStage(event.target.value)}
            aria-label="New deal stage"
          >
            {STAGE_ORDER.map(id => (
              <option key={id} value={id}>
                {STAGES[id].label}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            variant="primary"
            loading={savingStage}
            disabled={newStage === contact.deal_stage}
            onClick={handleStage}
          >
            Update stage
          </Button>
        </div>
      </section>

      <section className="customer__section">
        <h3>Business need</h3>
        <p>{contact.business_need || 'No business need recorded.'}</p>
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

          {!showTaskForm && (
            <Button size="sm" variant="primary" onClick={() => setShowTaskForm(true)}>
              <Icon name="plus" size={14} />
              Add follow-up
            </Button>
          )}
        </div>

        {showTaskForm && (
          <TaskForm
            today={today}
            customerId={contact.customer_id}
            onCreated={handleCreated}
            onCancel={() => setShowTaskForm(false)}
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
        <div className="customer__section-head">
          <h3>Activity</h3>

          {!showContactForm && (
            <Button size="sm" onClick={() => setShowContactForm(true)}>
              <Icon name="plus" size={14} />
              Log contact
            </Button>
          )}
        </div>

        {showContactForm && (
          <ContactForm
            customerId={contact.customer_id}
            onLogged={handleLogged}
            onCancel={() => setShowContactForm(false)}
          />
        )}

        {activities.length === 0 ? (
          <p className="muted">No activity yet.</p>
        ) : (
          <ol className="timeline">
            {activities.map(item => (
              <li key={item.activity_id} className="timeline__item">
                <p className="timeline__meta">
                  <Badge tone={item.kind === 'stage_change' ? 'warning' : 'neutral'}>
                    {item.kind === 'stage_change' ? 'Stage' : item.channel}
                  </Badge>
                  <span className="muted">{formatDate(item.occurred_at)}</span>
                </p>
                <p className="timeline__text" dir="auto">
                  {item.summary}
                </p>
              </li>
            ))}
          </ol>
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
