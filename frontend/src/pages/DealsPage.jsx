import { useState } from 'react'
import { isOpenStage, STAGES } from '../constants/stages'
import { useApi } from '../hooks/useApi'
import { formatDate, formatMoney, formatMoneyShort } from '../utils/format'
import StageBadge from '../components/StageBadge'
import StageProgress from '../components/StageProgress'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'

// "12 days ago" / "today" from the number the server calculated.
function daysAgo(days) {
  if (days == null) return 'Never'
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'

  return `${days} days ago`
}

// Pipeline view: a summary per stage, then the deals as a table.
// Clicking a row opens the customer drawer (#/deals/CON-…), which is
// rendered by App so it works on every page.
export default function DealsPage({ dataVersion }) {
  const [stage, setStage] = useState('')
  const [owner, setOwner] = useState('')
  const [stalledOnly, setStalledOnly] = useState(false)

  const query = new URLSearchParams({
    stage,
    owner,
    stalled: String(stalledOnly),
  }).toString()

  const list = useApi(`/deals?${query}`, {
    keepPrevious: true,
    refreshKey: dataVersion,
  })
  const filters = useApi('/customers/filters')

  const data = list.data
  const hasFilters = Boolean(stage || owner || stalledOnly)

  function clearFilters() {
    setStage('')
    setOwner('')
    setStalledOnly(false)
  }

  return (
    <div className="page">
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}

      {!data && !list.error && <LoadingState>Loading deals…</LoadingState>}

      {data && (
        <>
          {/* One button per stage; clicking filters the table to that stage. */}
          <div className="stage-strip" role="group" aria-label="Filter by stage">
            {data.summary.map(item => (
              <button
                key={item.stage}
                type="button"
                className="stage-chip"
                aria-pressed={stage === item.stage}
                onClick={() => setStage(stage === item.stage ? '' : item.stage)}
              >
                <span className="stage-chip__label">
                  {STAGES[item.stage].label}
                </span>
                <span className="stage-chip__count">{item.count}</span>
                <span className="stage-chip__value">
                  {formatMoneyShort(item.value)}
                </span>
              </button>
            ))}
          </div>

          <div className="toolbar">
            <select
              className="select"
              value={owner}
              onChange={event => setOwner(event.target.value)}
              aria-label="Filter by owner"
            >
              <option value="">All owners</option>
              {(filters.data?.owners || []).map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <label className="check">
              <input
                type="checkbox"
                checked={stalledOnly}
                onChange={event => setStalledOnly(event.target.checked)}
              />
              Stalled only ({data.stalled_total})
            </label>

            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>

          <p className="page-intro" aria-live="polite">
            {data.total} deal{data.total === 1 ? '' : 's'}
            {list.loading && ' · Updating…'} · Stalled means an open deal with
            no contact for {data.stale_after_days} days.
          </p>

          {data.total === 0 ? (
            <EmptyState icon="deals" title="No deals match">
              Try another stage or owner, or clear the filters.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Deal</th>
                    <th scope="col">Stage</th>
                    <th scope="col" className="table__num">Value</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Last contact</th>
                    <th scope="col">Next follow-up</th>
                  </tr>
                </thead>

                <tbody>
                  {data.items.map(item => {
                    const late =
                      isOpenStage(item.deal_stage) &&
                      item.next_followup_date &&
                      item.next_followup_date < data.as_of

                    return (
                      <tr
                        key={item.deal_id}
                        className="table__row--click"
                        onClick={() => {
                          window.location.hash = `#/deals/${encodeURIComponent(item.customer_id)}`
                        }}
                      >
                        <td>
                          <a
                            className="link table__strong"
                            href={`#/deals/${encodeURIComponent(item.customer_id)}`}
                            onClick={event => event.stopPropagation()}
                          >
                            {item.company_name}
                          </a>
                          <span className="table__sub">
                            {item.full_name} · {item.product_interest}
                          </span>
                        </td>
                        <td>
                          <StageBadge stage={item.deal_stage} />
                          <span className="table__sub">
                            <StageProgress stage={item.deal_stage} />
                          </span>
                        </td>
                        <td className="table__num">
                          {formatMoney(item.deal_value_sar)}
                        </td>
                        <td>{item.assigned_owner || '—'}</td>
                        <td>
                          {daysAgo(item.days_since_contact)}
                          {item.stalled && <Badge tone="warning">Stalled</Badge>}
                        </td>
                        <td>
                          {formatDate(item.next_followup_date)}
                          {late && <Badge tone="danger">Overdue</Badge>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
