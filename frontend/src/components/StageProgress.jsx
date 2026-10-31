import { PIPELINE } from '../constants/stages'
import { cx } from '../utils/cx'

// Six small bars showing how far a deal is along the pipeline.
// A lost deal shows empty red bars.
export default function StageProgress({ stage }) {
  const step = PIPELINE.indexOf(stage) + 1 // 0 for "lost"

  return (
    <span
      className={cx(
        'progress',
        stage === 'won' && 'progress--won',
        stage === 'lost' && 'progress--lost'
      )}
      role="img"
      aria-label={
        stage === 'lost'
          ? 'Lost'
          : `Stage ${step} of ${PIPELINE.length}`
      }
    >
      {PIPELINE.map((id, index) => (
        <span
          key={id}
          className={cx('progress__step', index < step && 'is-filled')}
        />
      ))}
    </span>
  )
}
