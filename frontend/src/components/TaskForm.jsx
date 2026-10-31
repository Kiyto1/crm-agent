import { useState } from 'react'
import { createTask } from '../services/tasksApi'
import { addDays } from '../utils/format'
import Button from './ui/Button'
import Input from './ui/Input'
import { Alert } from './ui/States'

// Form for a new follow-up task. Used in two places:
//  - customer drawer: pass `customerId` (the customer is fixed)
//  - Tasks page: pass `customers` (a dropdown to choose from)
// `today` (YYYY-MM-DD) comes from the server so both agree on the date.
export default function TaskForm({
  today,
  customerId: fixedCustomerId,
  customers = [],
  onCreated,
  onCancel,
}) {
  const [customerId, setCustomerId] = useState(fixedCustomerId || '')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(() => addDays(today, 3))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault() // stop the page from reloading
    setSaving(true)
    setError('')

    try {
      const task = await createTask({
        customerId,
        title: title.trim(),
        dueDate,
      })

      setTitle('')
      onCreated(task)
    } catch (requestError) {
      // Keep what the user typed so they can fix it and retry.
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      {!fixedCustomerId && (
        <label className="field">
          <span className="field__label">Customer</span>
          <select
            className="select"
            value={customerId}
            onChange={event => setCustomerId(event.target.value)}
            required
          >
            <option value="">Choose a customer…</option>
            {customers.map(customer => (
              <option key={customer.customer_id} value={customer.customer_id}>
                {customer.company_name} — {customer.full_name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span className="field__label">Task</span>
        <Input
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="e.g. Send the revised proposal"
          maxLength={200}
          required
        />
      </label>

      <label className="field">
        <span className="field__label">Due date</span>
        <Input
          type="date"
          value={dueDate}
          onChange={event => setDueDate(event.target.value)}
          required
        />
      </label>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="task-form__actions">
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          disabled={!customerId || !title.trim() || !dueDate}
        >
          Add task
        </Button>

        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
