import { STAGES } from '../constants/stages'
import Badge from './ui/Badge'

// A deal stage as a colored label, e.g. "Proposal sent".
export default function StageBadge({ stage }) {
  const info = STAGES[stage]

  if (!info) return <Badge>{stage || 'No stage'}</Badge>

  return <Badge tone={info.tone}>{info.label}</Badge>
}
