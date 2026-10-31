import { useEffect, useState } from 'react'
import { isOpenStage, STAGES } from '../constants/stages'
import { useApi } from '../hooks/useApi'
import { formatDate, formatMoney } from '../utils/format'
import CustomerDrawer from '../components/CustomerDrawer'
import StageBadge from '../components/StageBadge'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Input from '../components/ui/Input'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'

// `param` is the customer ID from the URL (#/customers/CON-21066).
// When it is set, the detail drawer is open for that customer.
export default function CustomersPage({ param, dataVersion }) {
  // searchText is what the user typed; search is the debounced value
  // that is sent to the server, so we don't ask on every keystroke.
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')
  const [owner, setOwner] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), 250)

    return () => clearTimeout(timer)
  }, [searchText])

  // The filters become the URL's query string: /customers?search=...&stage=...
  const query = new URLSearchParams({ search, stage, owner }).toString()
  const list = useApi(`/customers?${query}`, {
    keepPrevious: true,
    refreshKey: dataVersion,
  })
  const filters = useApi('/customers/filters')

  const hasFilters = Boolean(searchText || stage || owner)

  function clearFilters() {
    setSearchText('')
    setSearch('')
    setStage('')
    setOwner('')
  }

  function openCustomer(id) {
    window.location.hash = `#/customers/${encodeURIComponent(id)}`
  }

  function closeDrawer() {
    window.location.hash = '#/customers'
  }

  const items = list.data?.items
  const today = list.data?.as_of

  return (
    <div className="page">
      <div className="toolbar">
        <div className="toolbar__search">
          <Icon name="search" size={16} />
          <Input
            type="search"
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Search name, company or ID"
            aria-label="Search customers"
          />
        </div>

        <select
          className="select"
          value={stage}
          onChange={event => setStage(event.target.value)}
          aria-label="Filter by stage"
        >
          <option value="">All stages</option>
          {(filters.data?.stages || []).map(id => (
            <option key={id} value={id}>
              {STAGES[id]?.label || id}
            </option>
          ))}
        </select>

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

        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {/* Announced to screen readers whenever the count changes. */}
      <p className="page-intro" aria-live="polite">
        {items
          ? `${items.length} customer${items.length === 1 ? '' : 's'}`
          : ' '}
        {list.loading && items && ' · Updating…'}
      </p>

      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}

      {!items && !list.error && <LoadingState>Loading customers…</LoadingState>}

      {items && items.length === 0 && (
        <EmptyState icon="users" title="No customers match">
          Try a different search, or clear the filters.
        </EmptyState>
      )}

      {items && items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Company</th>
                <th scope="col">Stage</th>
                <th scope="col" className="table__num">Value</th>
                <th scope="col">Owner</th>
                <th scope="col">Next follow-up</th>
              </tr>
            </thead>

            <tbody>
              {items.map(item => {
                const late =
                  isOpenStage(item.deal_stage) &&
                  item.next_followup_date &&
                  item.next_followup_date < today

                return (
                  // The link in the first cell is for keyboards; the row click is a bonus for the mouse.
                  <tr
                    key={item.customer_id}
                    className="table__row--click"
                    onClick={() => openCustomer(item.customer_id)}
                  >
                    <td>
                      <a
                        className="link table__strong"
                        href={`#/customers/${encodeURIComponent(item.customer_id)}`}
                        onClick={event => event.stopPropagation()}
                      >
                        {item.full_name}
                      </a>
                      <span className="table__sub">{item.job_title}</span>
                    </td>
                    <td>
                      {item.company_name}
                      <span className="table__sub">{item.industry}</span>
                    </td>
                    <td>
                      <StageBadge stage={item.deal_stage} />
                    </td>
                    <td className="table__num">
                      {formatMoney(item.deal_value_sar)}
                    </td>
                    <td>{item.assigned_owner || '—'}</td>
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

      <CustomerDrawer
        customerId={param}
        onClose={closeDrawer}
        dataVersion={dataVersion}
      />
    </div>
  )
}
