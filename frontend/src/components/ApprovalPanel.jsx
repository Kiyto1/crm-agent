import Button from './ui/Button'

export default function ApprovalPanel({ proposal, busy, onApprove, onReject }) {
  if (!proposal) return null

  return (
    <section className="approval-panel" aria-label="Approval required">
      <div>
        <p className="approval-panel__eyebrow">Approval required</p>
        <h2 className="approval-panel__title">Review proposed changes</h2>
        <p className="approval-panel__lead">
          These updates will run only after you approve them.
        </p>
      </div>

      <div className="approval-panel__changes">
        {proposal.changes.map((change, index) => (
          <article
            className="approval-card"
            key={`${proposal.approval_id}-${index}`}
          >
            <h3 className="approval-card__name">
              {change.name.replaceAll('_', ' ')}
            </h3>

            <dl className="approval-card__fields">
              {Object.entries(change.args).map(([field, value]) => (
                <div key={field} className="approval-card__row">
                  <dt>{field.replaceAll('_', ' ')}</dt>
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
      </div>

      <div className="approval-panel__actions">
        <Button variant="primary" onClick={() => onApprove(true)} disabled={busy}>
          Approve all
        </Button>

        <Button variant="ghost" onClick={() => onReject(false)} disabled={busy}>
          Reject
        </Button>
      </div>
    </section>
  )
}
