import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app.js'
import { generateKeyPair } from '../chain/keypair.js'
import { hashPassword } from './auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = join(__dirname, '../../db/schema.sql')
const PASSWORD = 'Password123!'
const keyPair = generateKeyPair()

async function logIn(db: DatabaseType): Promise<string[]> {
  const res = await request(createApp({ db, keyPair }))
    .post('/api/auth/login')
    .send({ username: 'doctor_dr_house', password: PASSWORD })

  expect(res.status).toBe(200)
  return [res.headers['set-cookie'] ?? []].flat()
}

describe('stored sessions', () => {
  let db: DatabaseType

  beforeEach(() => {
    db = new Database(':memory:')
    db.exec(readFileSync(SCHEMA_PATH, 'utf-8'))
    db.prepare(
      'INSERT INTO users (username, password_hash, name, role, patient_id) VALUES (?, ?, ?, ?, ?)',
    ).run('doctor_dr_house', hashPassword(PASSWORD), 'Dr. Gregory House', 'DOCTOR', null)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    db.close()
  })

  it('keeps a user signed in across a restart that keeps the secret', async () => {
    vi.stubEnv('SESSION_SECRET', 'a-long-shared-secret-for-this-test')
    const cookies = await logIn(db)

    const restarted = createApp({ db, keyPair })
    const res = await request(restarted).get('/api/auth/session').set('Cookie', cookies)

    expect(res.status).toBe(200)
    expect(res.body.data.username).toBe('doctor_dr_house')
  })

  it('removes the stored session on logout', async () => {
    const app = createApp({ db, keyPair })
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'doctor_dr_house', password: PASSWORD })
    const cookies = [login.headers['set-cookie'] ?? []].flat()
    const stored = (): number =>
      (db.prepare('SELECT COUNT(*) AS count FROM sessions').get() as { count: number }).count

    expect(stored()).toBe(1)
    await request(app).post('/api/auth/logout').set('Cookie', cookies)

    expect(stored()).toBe(0)
  })

  it('marks the cookie Secure when configured, so it is never sent over plain http', async () => {
    vi.stubEnv('SESSION_COOKIE_SECURE', 'true')

    const cookies = await logIn(db)

    expect(cookies).toEqual([])
  })

  it('sets the Secure cookie behind a trusted HTTPS proxy', async () => {
    vi.stubEnv('SESSION_COOKIE_SECURE', 'true')
    vi.stubEnv('TRUST_PROXY', '1')

    const res = await request(createApp({ db, keyPair }))
      .post('/api/auth/login')
      .set('X-Forwarded-Proto', 'https')
      .send({ username: 'doctor_dr_house', password: PASSWORD })

    const cookies = [res.headers['set-cookie'] ?? []].flat()
    expect(cookies).toHaveLength(1)
    expect(cookies[0]).toContain('Secure')
  })

  it('does not accept one node’s cookie on another node, even with a shared secret', async () => {
    vi.stubEnv('SESSION_SECRET', 'a-long-shared-secret-for-this-test')
    const node1 = createApp({ db, keyPair, sessionCookieName: 'aletheia.sid.3001' })
    const node2 = createApp({ db, keyPair, sessionCookieName: 'aletheia.sid.3002' })
    const login = await request(node1)
      .post('/api/auth/login')
      .send({ username: 'doctor_dr_house', password: PASSWORD })
    const renamed = [login.headers['set-cookie'] ?? []]
      .flat()
      .map((cookie) => cookie.replace('aletheia.sid.3001', 'aletheia.sid.3002'))

    const res = await request(node2).get('/api/auth/session').set('Cookie', renamed)

    expect(res.status).toBe(401)
  })

  it('refuses to build the app in production without a session secret', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SESSION_SECRET', '')

    expect(() => createApp({ db, keyPair })).toThrow(/SESSION_SECRET/)
  })
})
