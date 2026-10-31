import { useState } from 'react'
import { STAGE_ORDER, STAGES } from '../constants/stages'
import { useApi } from '../hooks/useApi'
import { formatDate, formatMoney, formatMoneyShort } from '../utils/format'
import StageBadge from '../components/StageBadge'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import StatCard from '../components/ui/StatCard'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'

// What each entry in the recent-activity feed is called.
const ACTIVITY_LABELS = {
  note: { label: 'Note', tone: 'info' },
  task: { label: 'Task created', tone: 'warning' },
  contact: { label: 'Contact', tone: 'neutral' },
}

// How many cards a list shows before "Show all".
const PREVIEW_COUNT = 4

// "Omar Alotaibi" -> "OA" (for the round avatar).
function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase()
}

// Shows the first few items of a list and a button to see the rest.
// `children` is a function that renders whichever items should be visible.
function Expandable({ items, children }) {
  const [open, setOpen] = useState(false)
  const visible = open ? items : items.slice(0, PREVIEW_COUNT)

  return (
    <>
      {children(visible)}

      {items.length > PREVIEW_COUNT && (
        <Button
          variant="ghost"
          size="sm"
          block
          className="overview__more"
          aria-expanded={open}
          onClick={() => setOpen(value => !value)}
        >
          {open ? 'Show less' : `Show all ${items.length}`}
        </Button>
      )}
    </>
  )
}

// One small card: avatar, text, badges and a button that opens the customer.
function MiniCard({ name, title, text, badges, meta, customerId }) {
  return (
    <li className="mini">
      <span className="mini__avatar" aria-hidden="true">
        {initials(name)}
      </span>

      <div className="mini__main">
        <p className="mini__title">{title}</p>
        <p className="mini__text clamp-2" dir="auto">
          {text}
        </p>
        {meta && <p className="mini__meta">{meta}</p>}
      </div>

      <div className="mini__side">
        {badges}
        <Button
          size="sm"
          href={`#/customers/${encodeURIComponent(customerId)}`}
          aria-label={`View ${name}`}
        >
          View
        </Button>
      </div>
    </li>
  )
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

  // Win rate = won deals out of all finished (won + lost) deals.
  const lost = pipeline.stages.find(stage => stage.stage === 'lost')
  const finished = pipeline.won_count + (lost ? lost.count : 0)
  const winRate = finished ? Math.round((pipeline.won_count / finished) * 100) : 0
  const averageOpen = pipeline.open_count
    ? pipeline.open_value / pipeline.open_count
    : 0

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
        <Card title="Pipeline by stage" className="overview__pipeline">
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

          {/* Totals that fill the card and answer "how are we doing?" */}
          <dl className="pipe-summary">
            <div>
              <dt>Open deals</dt>
              <dd>{pipeline.open_count}</dd>
            </div>
            <div>
              <dt>Average deal</dt>
              <dd>{formatMoneyShort(averageOpen)}</dd>
            </div>
            <div>
              <dt>Win rate</dt>
              <dd>{winRate}%</dd>
            </div>
          </dl>
        </Card>

        <Card
          title="Customers needing attention"
          className="overview__attention"
        >
          {attention.items.length === 0 ? (
            <EmptyState icon="users" title="Nothing needs attention">
              Every open deal has a recent contact and an up-to-date follow-up.
            </EmptyState>
          ) : (
            <Expandable items={attention.items}>
              {visible => (
                <ul className="mini-list">
                  {visible.map(item => (
                    <MiniCard
                      key={item.customer_id}
                      customerId={item.customer_id}
                      name={item.full_name}
                      title={item.full_name}
                      text={`${item.company_name} · ${formatMoney(
                        item.deal_value_sar
                      )}`}
                      meta={<Badge tone="danger">{item.reason}</Badge>}
                      badges={<StageBadge stage={item.deal_stage} />}
                    />
                  ))}
                </ul>
              )}
            </Expandable>
          )}
        </Card>

        <Card title="Recent activity" className="overview__activity">
          {activity.length === 0 ? (
            <EmptyState icon="notes" title="No activity yet">
              Notes, tasks and customer contacts will appear here.
            </EmptyState>
          ) : (
            <Expandable items={activity}>
              {visible => (
                <ul className="mini-list">
                  {visible.map((item, index) => (
                    <MiniCard
                      key={`${item.kind}-${index}`}
                      customerId={item.customer_id}
                      name={item.full_name}
                      title={item.full_name}
                      text={item.text}
                      meta={formatDate(item.happened_at)}
                      badges={
                        <Badge tone={ACTIVITY_LABELS[item.kind].tone}>
                          {ACTIVITY_LABELS[item.kind].label}
                        </Badge>
                      }
                    />
                  ))}
                </ul>
              )}
            </Expandable>
          )}
        </Card>
      </div>
    </div>
  )
}
