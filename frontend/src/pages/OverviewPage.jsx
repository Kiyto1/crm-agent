import { STAGE_ORDER, STAGES } from '../constants/stages'
import { useApi } from '../hooks/useApi'
import { formatDate, formatMoney, formatMoneyShort } from '../utils/format'
import StageBadge from '../components/StageBadge'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import StatCard from '../components/ui/StatCard'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'

// What each entry in the recent-activity feed is called.
const ACTIVITY_LABELS = {
  note: { label: 'Note', tone: 'info' },
  task: { label: 'Task created', tone: 'warning' },
  contact: { label: 'Contact', tone: 'neutral' },
}

// Everything on this page comes from GET /overview, which calculates the
// numbers from the database records on each request.
export default function OverviewPage({ dataVersion }) {
  const { data, loading, error, reload } = useApi('/overview', {
    refreshKey: dataVersion,
  })

  if (error && !data) {
    return (
      <div className="page">
        <ErrorState message={error} onRetry={reload} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page">
        <LoadingState>Loading overview…</LoadingState>
      </div>
    )
  }

  const { pipeline, attention, recent_activity: activity } = data

  // The longest bar is the stage with the highest value.
  const maxValue = Math.max(...pipeline.stages.map(stage => stage.value), 1)

  const stages = STAGE_ORDER.map(id =>
    pipeline.stages.find(stage => stage.stage === id)
  ).filter(Boolean)

  return (
    <div className="page overview">
      {/* A failed refresh keeps the old numbers and says so. */}
      {error && <ErrorState message={error} onRetry={reload} />}

      <p className="page-intro">
        Calculated from your records as of {formatDate(data.as_of)}.
        {loading && ' Refreshing…'}
      </p>

      <div className="stat-grid">
        <StatCard
          label="Open pipeline"
          value={formatMoneyShort(pipeline.open_value)}
          hint={`${pipeline.open_count} open deals · ${formatMoneyShort(
            pipeline.won_value
          )} won`}
        />
        <StatCard
          label="Overdue follow-ups"
          value={data.overdue_followups}
          tone={data.overdue_followups > 0 ? 'danger' : 'success'}
          hint="Customer follow-up dates and tasks past due"
        />
        <StatCard
          label="Open tasks"
          value={data.open_tasks}
          hint="Tasks you can complete or reschedule"
          href="#/tasks"
        />
        <StatCard
          label="Need attention"
          value={attention.total}
          tone={attention.total > 0 ? 'warning' : 'success'}
          hint="Open deals with a late follow-up or no recent contact"
          href="#/customers"
        />
      </div>

      <div className="overview__grid">
        <Card title="Pipeline by stage">
          <ul className="bars">
            {stages.map(stage => (
              <li key={stage.stage} className="bars__row">
                <span className="bars__label">{STAGES[stage.stage].label}</span>

                <span className="bars__track" aria-hidden="true">
                  <span
                    className={`bars__fill bars__fill--${STAGES[stage.stage].tone}`}
                    style={{ width: `${(stage.value / maxValue) * 100}%` }}
                  />
                </span>

                <span className="bars__value">
                  {stage.count} · {formatMoneyShort(stage.value)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Customers needing attention">
          {attention.items.length === 0 ? (
            <EmptyState icon="users" title="Nothing needs attention">
              Every open deal has a recent contact and an up-to-date follow-up.
            </EmptyState>
          ) : (
            <ul className="item-list">
              {attention.items.map(item => (
                <li key={item.customer_id} className="item-list__row">
                  <div>
                    <a
                      className="item-list__title link"
                      href={`#/customers/${item.customer_id}`}
                    >
                      {item.full_name}
                    </a>
                    <p className="muted">
                      {item.company_name} · {formatMoney(item.deal_value_sar)}
                    </p>
                    <p className="muted">{item.reason}</p>
                  </div>

                  <StageBadge stage={item.deal_stage} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Recent activity">
        {activity.length === 0 ? (
          <EmptyState icon="notes" title="No activity yet">
            Notes, tasks and customer contacts will appear here.
          </EmptyState>
        ) : (
          <ul className="item-list">
            {activity.map((item, index) => (
              <li key={`${item.kind}-${index}`} className="item-list__row">
                <div>
                  <p className="item-list__title" dir="auto">
                    <a className="link" href={`#/customers/${item.customer_id}`}>
                      {item.full_name}
                    </a>
                  </p>
                  <p className="muted clamp-2" dir="auto">
                    {item.text}
                  </p>
                </div>

                <div className="item-list__meta">
                  <Badge tone={ACTIVITY_LABELS[item.kind].tone}>
                    {ACTIVITY_LABELS[item.kind].label}
                  </Badge>
                  <span className="muted">
                    {formatDate(item.happened_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
