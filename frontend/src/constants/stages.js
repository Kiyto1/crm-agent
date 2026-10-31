// Deal stages as stored in the database, with a label and badge color.
export const STAGES = {
  new: { label: 'New', tone: 'neutral' },
  qualified: { label: 'Qualified', tone: 'info' },
  demo_scheduled: { label: 'Demo scheduled', tone: 'info' },
  proposal_sent: { label: 'Proposal sent', tone: 'warning' },
  negotiation: { label: 'Negotiation', tone: 'warning' },
  won: { label: 'Won', tone: 'success' },
  lost: { label: 'Lost', tone: 'danger' },
}

// Every stage, in pipeline order (used for lists and dropdowns).
export const STAGE_ORDER = Object.keys(STAGES)

// The path a deal takes to be won. "lost" can happen at any point,
// so it is not a step on this path.
export const PIPELINE = [
  'new',
  'qualified',
  'demo_scheduled',
  'proposal_sent',
  'negotiation',
  'won',
]

// Won and lost deals are finished, so they are not "open".
export function isOpenStage(stage) {
  return stage !== 'won' && stage !== 'lost'
}
