import type { Database as DatabaseType } from 'better-sqlite3'
import type { Blockchain } from '../chain/blockchain.js'
import type { AccessEvent } from '../chain/access-event.js'

// The entry as docs/interfaces.md defines it. No patientId: the patient is the URL.
export interface AccessLogEntry {
  eventId: string
  userId: number
  userName: string
  role: AccessEvent['role']
  action: AccessEvent['action']
  timestamp: string
  serverId: string
  blockIndex: number
}

function userNames(db: DatabaseType, userIds: readonly number[]): Map<number, string> {
  if (userIds.length === 0) return new Map()

  const placeholders = userIds.map(() => '?').join(', ')
  const rows = db
    .prepare(`SELECT id, name FROM users WHERE id IN (${placeholders})`)
    .all(...userIds) as { id: number; name: string }[]

  return new Map(rows.map((row) => [row.id, row.name]))
}

// Reads the chain, not the database: the log is whatever the blocks say happened, which
// is the point of keeping it here. Events still pending a block are not in it yet.
export function collectAccessLog(
  db: DatabaseType,
  blockchain: Blockchain,
  patientId: number,
): AccessLogEntry[] {
  const found = blockchain.chain.flatMap((block) =>
    block.data
      .filter((event) => event.patientId === patientId)
      .map((event) => ({ event, blockIndex: block.index })),
  )

  const names = userNames(db, [...new Set(found.map(({ event }) => event.userId))])

  return found.map(({ event, blockIndex }) => ({
    eventId: event.id,
    userId: event.userId,
    userName: names.get(event.userId) ?? 'Unknown user',
    role: event.role,
    action: event.action,
    timestamp: event.timestamp,
    serverId: event.serverId,
    blockIndex,
  }))
}
