export interface TeamMember {
  name: string
  /** GitHub username, without the @. */
  handle: string
  track: string
}

// The same people and tracks as "Who worked on it" in the README; change both together.
export const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    name: 'Ruslan Galiyev',
    handle: '0pStack',
    track: 'Frontend — login, patient search, journal, access log, design',
  },
  {
    name: 'Anders Kull',
    handle: 'Andkull',
    track: 'Chain — blocks, Merkle tree, persistence; database schema',
  },
  {
    name: 'Bobby Trinh',
    handle: 'bobtri',
    track: 'Backend — roles, note visibility, audit logging, signing',
  },
  {
    name: 'Hani Baloch',
    handle: 'hanisheksson84-maker',
    track: 'P2P — node bootstrap, WebSocket server, peer connections',
  },
]

export const githubProfile = (handle: string) => `https://github.com/${handle}`
