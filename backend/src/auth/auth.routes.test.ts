import Database, { type Database as DatabaseType } from 'better-sqlite3'
import type { Express } from 'express'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { generateKeyPair } from '../chain/keypair.js'
import { hashPassword } from './auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = join(__dirname, '../../db/schema.sql')
const PASSWORD = 'Password123!'

let db: DatabaseType
let app: Express
let annaPatientId: number

beforeAll(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(readFileSync(SCHEMA_PATH, 'utf-8'))

  const insertPatient = db.prepare('INSERT INTO patients (name, personal_number) VALUES (?, ?)')
  const insertUser = db.prepare(
    'INSERT INTO users (username, password_hash, name, role, patient_id) VALUES (?, ?, ?, ?, ?)',
  )

  annaPatientId = Number(insertPatient.run('Anna Andersson', '19850101-1234').lastInsertRowid)

  const passwordHash = hashPassword(PASSWORD)

  insertUser.run('doctor_dr_house', passwordHash, 'Dr. Gregory House', 'DOCTOR', null)
  insertUser.run('patient_anna', passwordHash, 'Anna Andersson', 'PATIENT', annaPatientId)
  insertUser.run('unauth_user', passwordHash, 'Eve Stranded', 'UNAUTHORIZED', null)

  app = createApp({ db, keyPair: generateKeyPair() })
})

afterAll(() => {
  db.close()
})

describe('POST /api/auth/login', () => {
  it('logs a doctor in and returns the user in the envelope', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'doctor_dr_house', password: PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      success: true,
      error: null,
      data: {
        user: {
          id: expect.any(Number),
          username: 'doctor_dr_house',
          name: 'Dr. Gregory House',
          role: 'DOCTOR',
          patientId: null,
        },
      },
    })
  })

  it('sets an httpOnly, sameSite session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'doctor_dr_house', password: PASSWORD })

    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined
    const sessionCookie = cookies?.find((cookie) => cookie.startsWith('connect.sid='))

    expect(sessionCookie).toBeDefined()
    expect(sessionCookie?.toLowerCase()).toContain('httponly')
    expect(sessionCookie?.toLowerCase()).toContain('samesite=lax')
  })

  it('never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'doctor_dr_house', password: PASSWORD })

    expect(JSON.stringify(res.body)).not.toContain('password')
  })

  it('returns the linked patientId for a patient user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'patient_anna', password: PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.data.user.role).toBe('PATIENT')
    expect(res.body.data.user.patientId).toBe(annaPatientId)
  })

  it('lets an UNAUTHORIZED user log in, so the access denied page can be shown', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'unauth_user', password: PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.data.user.role).toBe('UNAUTHORIZED')
  })

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'doctor_dr_house', password: 'wrong-password' })

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.data).toBeNull()
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('gives the same error for an unknown username, so usernames cannot be probed', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'no_such_user', password: PASSWORD })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('rejects a missing password with BAD_REQUEST', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'doctor_dr_house' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('rejects an empty body with BAD_REQUEST', async () => {
    const res = await request(app).post('/api/auth/login').send({})

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('rejects a non-string password with BAD_REQUEST', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'doctor_dr_house', password: { $ne: null } })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })
})

describe('GET /api/auth/session', () => {
  it('returns 401 UNAUTHENTICATED without a cookie', async () => {
    const res = await request(app).get('/api/auth/session')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns the user object directly in data when signed in', async () => {
    const agent = request.agent(app)

    await agent.post('/api/auth/login').send({ username: 'doctor_dr_house', password: PASSWORD })

    const res = await agent.get('/api/auth/session')

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      username: 'doctor_dr_house',
      role: 'DOCTOR',
    })
  })

  it('keeps the session across several requests', async () => {
    const agent = request.agent(app)

    await agent.post('/api/auth/login').send({ username: 'patient_anna', password: PASSWORD })

    await agent.get('/api/auth/session')
    const res = await agent.get('/api/auth/session')

    expect(res.status).toBe(200)
    expect(res.body.data.username).toBe('patient_anna')
  })
})

describe('POST /api/auth/logout', () => {
  it('ends the session so /session returns 401 afterwards', async () => {
    const agent = request.agent(app)

    await agent.post('/api/auth/login').send({ username: 'doctor_dr_house', password: PASSWORD })

    const logout = await agent.post('/api/auth/logout')

    expect(logout.status).toBe(200)
    expect(logout.body.data).toEqual({ message: 'Logged out successfully' })

    const session = await agent.get('/api/auth/session')
    expect(session.status).toBe(401)
  })

  it('returns 401 when nobody is signed in', async () => {
    const res = await request(app).post('/api/auth/logout')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })
})
