import type { AccessLogAction } from '../../api/schemas'
import { ROLE_LABELS } from '../../shared/roleLabels'
import { Button } from '../../shared/ui/Button/Button'
import { useAccessLog } from './useAccessLog'
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

  return (
    <div className={styles.scroll}>
      <table className={styles.table} aria-label="Access log">
        <thead>
          <tr>
            <th scope="col">Who</th>
            <th scope="col">What</th>
            <th scope="col">When</th>
            <th scope="col">Where</th>
          </tr>
        </thead>
        <tbody>
          {log.data.map((entry) => (
            <tr key={entry.eventId} data-refused={entry.action === 'DENIED' || undefined}>
              <td>
                <span className={styles.who}>{entry.userName}</span>
                <span className={styles.role}>{ROLE_LABELS[entry.role]}</span>
              </td>
              <td>{ACTION_LABELS[entry.action]}</td>
              <td>
                <time dateTime={entry.timestamp}>
                  {dateFormat.format(new Date(entry.timestamp))}
                </time>
              </td>
              {/* Which node recorded it, and the block it sits in: the entry is on the
                  chain, not in a table someone could quietly edit. */}
              <td className={styles.origin}>
                {entry.serverId} <span className={styles.block}>#{entry.blockIndex}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
