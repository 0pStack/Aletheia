import { useQuery } from '@tanstack/react-query'
import { ApiError, request } from '../../api/http'
import { queryKeys } from '../../api/queryKeys'
import { eventProofSchema } from '../../api/schemas'

export type VerificationStatus = 'checking' | 'verified' | 'pending' | 'failed' | 'unchecked'

export interface Verification {
  status: VerificationStatus
  recheck: () => void
}

// The server answers 409 PENDING for an event not yet sealed into a block and asks the
// client to come back in a few seconds. A 429 means this user spent the minute's budget
// of 60 checks, so the badge waits out most of that window before asking again.
const PENDING_RETRY_MS = 5000
const RATE_LIMITED_RETRY_MS = 30_000

// Each proof re-validates the chain on the server, so returning to the page within a
// minute reuses the answer rather than spending the rate limit again.
const PROOF_STALE_MS = 60_000

function errorCode(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null
}

function retryDelay(error: unknown): number | false {
  const code = errorCode(error)
  if (code === 'PENDING') return PENDING_RETRY_MS
  if (code === 'RATE_LIMITED') return RATE_LIMITED_RETRY_MS
  return false
}

function useVerificationQuery(eventId: string) {
  return useQuery({
    queryKey: queryKeys.verification(eventId),
    queryFn: () => request(`/api/verify/${eventId}`, eventProofSchema),
    retry: false,
    staleTime: PROOF_STALE_MS,
    refetchInterval: (current) => retryDelay(current.state.error),
  })
}

export function useVerification(eventId: string): Verification {
  const query = useVerificationQuery(eventId)
  return { status: toStatus(query), recheck: () => void query.refetch() }
}

function toStatus(query: ReturnType<typeof useVerificationQuery>): VerificationStatus {
  if (query.isPending) return 'checking'
  if (query.isSuccess) return query.data.isValid ? 'verified' : 'failed'
  const code = errorCode(query.error)
  if (code === 'PENDING') return 'pending'
  // An event the access log lists but the chain no longer holds has lost its proof.
  // Anything else (rate limit, network, server fault) means the chain was never asked,
  // and calling that Failed would accuse the record of tampering it may not have.
  if (code === 'NOT_FOUND') return 'failed'
  return 'unchecked'
}
