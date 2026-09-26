import { useVerification, type VerificationStatus } from './useVerification'
import styles from './VerificationBadge.module.css'

const STATUS_LABELS: Record<VerificationStatus, string> = {
  checking: 'Checking',
  verified: 'Verified',
  pending: 'Pending',
  failed: 'Failed',
  unchecked: 'Not checked',
}

// Hover text for the word; the word itself carries the status (DESIGN.md, The Scene
// Owns Colour Rule), so nothing depends on this being read.
const STATUS_DETAILS: Record<VerificationStatus, string> = {
  checking: 'Asking the chain for a proof of this entry',
  verified: 'A Merkle proof shows this entry is unchanged on the chain',
  pending: 'Waiting to be sealed into a block',
  failed: 'The chain no longer proves this entry as recorded',
  unchecked: 'The check could not be completed. Select to try again',
}

interface VerificationBadgeProps {
  eventId: string
}

export function VerificationBadge({ eventId }: VerificationBadgeProps) {
  const { status, recheck } = useVerification(eventId)

  // The one state a person can do something about gets to be pressed.
  if (status === 'unchecked') {
    return (
      <button
        type="button"
        className={styles.badge}
        data-status={status}
        title={STATUS_DETAILS[status]}
        aria-label={`${STATUS_LABELS[status]}. Check again`}
        onClick={recheck}
      >
        {STATUS_LABELS[status]}
      </button>
    )
  }

  return (
    <span className={styles.badge} data-status={status} title={STATUS_DETAILS[status]}>
      {STATUS_LABELS[status]}
    </span>
  )
}
