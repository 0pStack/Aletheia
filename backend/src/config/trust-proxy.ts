// Behind a proxy that terminates HTTPS, Express sees plain http and never sets a Secure
// cookie. This is how many proxy hops may speak for the client. Trusting a proxy that is
// not there lets any client fake its address and protocol, so only a count is accepted.
export function resolveTrustProxy(raw: string | undefined): number {
  const trimmed = raw?.trim()
  if (!trimmed) return 0

  const hops = Number(trimmed)

  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(`TRUST_PROXY must be a number of proxy hops, got "${trimmed}"`)
  }

  return hops
}
