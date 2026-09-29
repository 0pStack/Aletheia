export const PEER_RECONNECT_BASE_DELAY_MS = 1000
export const PEER_RECONNECT_MAX_DELAY_MS = 30_000

// Half the delay is fixed and half is random, so nodes that lost the same peer spread their
// retries out while the wait still grows with every failure.
export function peerReconnectDelay(attempt: number, random: () => number = Math.random): number {
  const capped = Math.min(PEER_RECONNECT_BASE_DELAY_MS * 2 ** attempt, PEER_RECONNECT_MAX_DELAY_MS)

  return Math.round(capped / 2 + (random() * capped) / 2)
}
