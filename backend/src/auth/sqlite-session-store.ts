import type { Database as DatabaseType } from 'better-sqlite3'
import session, { type SessionData } from 'express-session'

const DEFAULT_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000

export interface SqliteSessionStoreOptions {
  readonly now?: () => number
}

type Callback = (error?: unknown) => void

// Statements are prepared on use rather than in the constructor: the app is also built
// against a database that has no tables yet (a fresh CI checkout), and only a request
// that carries a session ever reaches the store.
export class SqliteSessionStore extends session.Store {
  private readonly db: DatabaseType
  private readonly now: () => number

  constructor(db: DatabaseType, options: SqliteSessionStoreOptions = {}) {
    super()
    this.db = db
    this.now = options.now ?? Date.now
  }

  override get(
    sid: string,
    callback: (error: unknown, session?: SessionData | null) => void,
  ): void {
    try {
      const row = this.db
        .prepare('SELECT sess FROM sessions WHERE sid = ? AND expired > ?')
        .get(sid, this.now()) as { sess: string } | undefined

      callback(null, row ? (JSON.parse(row.sess) as SessionData) : null)
    } catch (error) {
      callback(error)
    }
  }

  override set(sid: string, sessionData: SessionData, callback?: Callback): void {
    try {
      const now = this.now()
      this.db.prepare('DELETE FROM sessions WHERE expired <= ?').run(now)
      this.db
        .prepare(
          `INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired`,
        )
        .run(sid, JSON.stringify(sessionData), this.expiryOf(sessionData, now))
      callback?.()
    } catch (error) {
      callback?.(error)
    }
  }

  override destroy(sid: string, callback?: Callback): void {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid)
      callback?.()
    } catch (error) {
      callback?.(error)
    }
  }

  override touch(sid: string, sessionData: SessionData, callback?: Callback): void {
    try {
      this.db
        .prepare('UPDATE sessions SET expired = ? WHERE sid = ?')
        .run(this.expiryOf(sessionData, this.now()), sid)
      callback?.()
    } catch (error) {
      callback?.(error)
    }
  }

  private expiryOf(sessionData: SessionData, now: number): number {
    const expires = sessionData.cookie.expires
    return expires ? new Date(expires).getTime() : now + DEFAULT_SESSION_LIFETIME_MS
  }
}
