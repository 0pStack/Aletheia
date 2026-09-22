export function resolvePeers(rawPeers: string | undefined): string[] {
  if (!rawPeers?.trim()) return []

  return rawPeers
    .split(',')
    .map((peer) => peer.trim())
    .filter(Boolean)
}
