import { useState } from 'react'
import { logContact } from '../services/dealsApi'
import Button from './ui/Button'
import Input from './ui/Input'
import { Alert } from './ui/States'

// Must match CHANNELS in scripts/deals.py (the server checks it again).
const CHANNELS = ['Phone', 'Email', 'Meeting', 'WhatsApp']

// Small form to record a contact that already happened.
export default function ContactForm({ customerId, onLogged, onCancel }) {
  const [channel, setChannel] = useState('Phone')
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      await logContact(customerId, channel, summary.trim())
      onLogged()
    } catch (requestError) {
      // Keep what the user typed so they can retry.
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <label className="field">
        <span className="field__label">How</span>
        <select
          className="select"
          value={channel}
          onChange={event => setChannel(event.target.value)}
        >
          {CHANNELS.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">What happened</span>
        <Input
          value={summary}
          onChange={event => setSummary(event.target.value)}
          placeholder="e.g. Agreed to review the proposal this week"
          maxLength={500}
          required
        />
      </label>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="task-form__actions">
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          disabled={!summary.trim()}
        >
          Save contact
        </Button>

        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
