import Badge from './ui/Badge'
import Button from './ui/Button'

// Friendly names for the tool names the backend sends.
const ACTION_LABELS = {
  create_task: 'Create task',
  complete_task: 'Complete task',
  reschedule_task: 'Reschedule task',
  add_note: 'Add note',
}

// Friendly names for argument fields.
const FIELD_LABELS = {
  customer_id: 'Customer',
  task_id: 'Task ID',
  title: 'Task',
  due_date: 'Due date',
  content: 'Note',
}

// Compact card listing the changes the assistant PROPOSES.
// Nothing is saved until the user presses Approve.
export default function ApprovalPanel({ proposal, busy, onApprove, onReject }) {
  if (!proposal) return null

  const many = proposal.changes.length > 1

  return (
    <section className="approval" aria-label="Approval required">
      <header className="approval__header">
        <Badge tone="warning">Proposed · not saved yet</Badge>
      </header>

      {proposal.changes.map((change, index) => (
        <article
          className="approval__card"
          key={`${proposal.approval_id}-${index}`}
        >
          <h3 className="approval__name">
            {ACTION_LABELS[change.name] || change.name.replaceAll('_', ' ')}
          </h3>

          <dl className="approval__fields">
            {Object.entries(change.args).map(([field, value]) => (
              <div key={field} className="approval__row">
                <dt>{FIELD_LABELS[field] || field.replaceAll('_', ' ')}</dt>
                <dd dir="auto">
                  {typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </article>
      ))}

      <div className="approval__actions">
        <Button
          variant="primary"
          size="sm"
          onClick={() => onApprove(true)}
          disabled={busy}
        >
          {many ? 'Approve all' : 'Approve'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onReject(false)}
          disabled={busy}
        >
          Reject
        </Button>
      </div>
    </section>
  )
}
