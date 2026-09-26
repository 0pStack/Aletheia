import type { AccessLogAction } from '../../api/schemas'
import { ROLE_LABELS } from '../../shared/roleLabels'
import { Button } from '../../shared/ui/Button/Button'
import { useAccessLog } from './useAccessLog'
import { VerificationBadge } from './VerificationBadge'
import styles from './AccessLog.module.css'

// The chain speaks in verbs; a person reading their own record should not have to.
const ACTION_LABELS: Record<AccessLogAction, string> = {
  READ: 'Opened the record',
  WRITE: 'Wrote a note',
  DENIED: 'Was refused',
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

interface AccessLogProps {
  patientId: number
}

export function AccessLog({ patientId }: AccessLogProps) {
  const log = useAccessLog(patientId)

  if (log.isPending) return <p role="status">Loading the access log…</p>

  if (log.isError) {
    return (
      <div className={styles.state}>
        <p>{log.error.message}</p>
        <Button onClick={() => void log.refetch()} disabled={log.isFetching}>
          Try again
        </Button>
      </div>
    )
  }

  if (log.data.length === 0) {
    return <p className={styles.empty}>No one has opened this record yet.</p>
  }

  // A timeline rather than a table: it reads as a record kept over time, with room on
  // each entry for its verification badge.
  return (
    <ol className={styles.timeline} aria-label="Access log">
      {log.data.map((entry) => (
        <li
          key={entry.eventId}
          className={styles.entry}
          data-refused={entry.action === 'DENIED' || undefined}
        >
          <p className={styles.who}>
            {entry.userName} <span className={styles.role}>{ROLE_LABELS[entry.role]}</span>
          </p>
          <p className={styles.what}>
            {ACTION_LABELS[entry.action]}
            <time dateTime={entry.timestamp}>{dateFormat.format(new Date(entry.timestamp))}</time>
          </p>
          {/* Which node recorded it, and the block it sits in: the entry is on the
              chain, not in a table someone could quietly edit. */}
          <p className={styles.origin}>
            Recorded by {entry.serverId}, block #{entry.blockIndex}
            <VerificationBadge eventId={entry.eventId} />
          </p>
        </li>
      ))}
    </ol>
  )
}
