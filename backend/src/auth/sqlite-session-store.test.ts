import Database, { type Database as DatabaseType } from 'better-sqlite3'
import type { SessionData } from 'express-session'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteSessionStore } from './sqlite-session-store.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = join(__dirname, '../../db/schema.sql')
const HOUR_MS = 60 * 60 * 1000
const START = Date.parse('2026-09-30T10:00:00.000Z')

function sessionExpiringAt(expires: number): SessionData {
  return {
    cookie: { originalMaxAge: HOUR_MS, expires: new Date(expires), httpOnly: true, path: '/' },
    user: {
      id: 1,
      username: 'doctor_dr_house',
      name: 'Dr. Gregory House',
      role: 'DOCTOR',
      patientId: null,
    },
  } as SessionData
}

describe('SqliteSessionStore', () => {
  let db: DatabaseType
  let now: number
  let store: SqliteSessionStore

  const get = (sid: string): Promise<SessionData | null | undefined> =>
    new Promise((resolve, reject) => {
      store.get(sid, (error, session) => (error ? reject(error) : resolve(session)))
    })

  const set = (sid: string, session: SessionData): Promise<void> =>
    new Promise((resolve, reject) => {
      store.set(sid, session, (error) => (error ? reject(error) : resolve()))
    })

  const destroy = (sid: string): Promise<void> =>
    new Promise((resolve, reject) => {
      store.destroy(sid, (error) => (error ? reject(error) : resolve()))
    })

  const touch = (sid: string, session: SessionData): Promise<void> =>
    new Promise((resolve, reject) => {
      store.touch(sid, session, (error) => (error ? reject(error) : resolve()))
    })

  const rowCount = (): number =>
    (db.prepare('SELECT COUNT(*) AS count FROM sessions').get() as { count: number }).count

  beforeEach(() => {
    db = new Database(':memory:')
    db.exec(readFileSync(SCHEMA_PATH, 'utf-8'))
    now = START
    store = new SqliteSessionStore(db, { now: () => now })
  })

  afterEach(() => {
    db.close()
  })

  it('returns a stored session', async () => {
    const session = sessionExpiringAt(START + HOUR_MS)

    await set('sid-1', session)

    expect(await get('sid-1')).toEqual(JSON.parse(JSON.stringify(session)))
  })

  it('returns nothing for an unknown session id', async () => {
    expect(await get('missing')).toBeNull()
  })

  it('does not return a session once it has expired', async () => {
    await set('sid-1', sessionExpiringAt(START + HOUR_MS))
    now = START + HOUR_MS

    expect(await get('sid-1')).toBeNull()
  })

  it('replaces a session saved again under the same id', async () => {
    await set('sid-1', sessionExpiringAt(START + HOUR_MS))
    const updated = { ...sessionExpiringAt(START + 2 * HOUR_MS), user: undefined }

    await set('sid-1', updated)

    expect((await get('sid-1'))?.user).toBeUndefined()
    expect(rowCount()).toBe(1)
  })

  it('forgets a destroyed session', async () => {
    await set('sid-1', sessionExpiringAt(START + HOUR_MS))

    await destroy('sid-1')

    expect(await get('sid-1')).toBeNull()
  })

  it('keeps a touched session alive past its old expiry', async () => {
    await set('sid-1', sessionExpiringAt(START + HOUR_MS))

    await touch('sid-1', sessionExpiringAt(START + 3 * HOUR_MS))
    now = START + 2 * HOUR_MS

    expect(await get('sid-1')).not.toBeNull()
  })

  it('deletes expired sessions when a new one is saved', async () => {
    await set('old', sessionExpiringAt(START + HOUR_MS))
    now = START + 2 * HOUR_MS

    await set('new', sessionExpiringAt(now + HOUR_MS))

    expect(rowCount()).toBe(1)
  })

  it('falls back to a default lifetime for a session without an expiry', async () => {
    const session = { cookie: { originalMaxAge: null, path: '/' } } as unknown as SessionData

    await set('sid-1', session)

    expect(await get('sid-1')).not.toBeNull()
  })

  it('reports a stored session it cannot read instead of throwing', async () => {
    db.prepare('INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)').run(
      'sid-1',
      'not json',
      START + HOUR_MS,
    )

    await expect(get('sid-1')).rejects.toThrow()
  })

  it('reports a database failure through the callback', async () => {
    db.exec('DROP TABLE sessions')

    await expect(set('sid-1', sessionExpiringAt(START + HOUR_MS))).rejects.toThrow()
    await expect(get('sid-1')).rejects.toThrow()
  })
})
