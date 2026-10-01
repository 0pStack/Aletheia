import { useQuery } from '@tanstack/react-query'
import { request } from '../../api/http'
import { queryKeys } from '../../api/queryKeys'
import { chainStatusSchema } from '../../api/schemas'
import styles from './TamperAlert.module.css'

// Each check re-validates every block on the server, so it is polled gently.
const POLL_MS = 10_000

const detectedTime = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })

export function TamperAlert() {
  const status = useQuery({
    queryKey: queryKeys.chainStatus,
    queryFn: () => request('/api/chain/status', chainStatusSchema),
    refetchInterval: POLL_MS,
    // The next poll is the retry.
    retry: false,
  })

  // A failed status check says nothing about the chain, so it is not reported as tampering.
  const tamper = status.data?.tamperDetected
  if (!tamper) return null

  return (
    <p
      role="status"
      className={styles.alert}
      title={`Detected ${detectedTime.format(new Date(tamper.detectedAt))}`}
    >
      <span className={styles.dot} aria-hidden="true" />
      Tampered at block {tamper.blockIndex}
      {status.data?.valid && ' · repaired'}
    </p>
  )
}
