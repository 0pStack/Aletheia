import Database, { type Database as DatabaseType } from 'better-sqlite3'
import type { Express } from 'express'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { hashPassword } from '../auth/auth.js'
import { Blockchain } from '../chain/blockchain.js'
import { generateKeyPair } from '../chain/keypair.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = join(__dirname, '../../db/schema.sql')
const PASSWORD = 'Password123!'
const PROOF_FIELDS = ['blockHash', 'blockIndex', 'eventId', 'isValid', 'merkleRoot', 'proof']

let db: DatabaseType
let app: Express
let blockchain: Blockchain
let annaId: number
let bengtId: number

function addUser(username: string, role: string, patientId: number | null): void {
  db.prepare(
    `INSERT INTO users (username, password_hash, name, role, patient_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(username, hashPassword(PASSWORD), username, role, patientId)
}

async function loginAs(username: string, target: Express = app) {
  const agent = request.agent(target)
  await agent.post('/api/auth/login').send({ username, password: PASSWORD })
  return agent
}

// The doctor opening a record is what puts an event on the chain.
async function eventIdForReadOf(patientId: number): Promise<string> {
  const doctor = await loginAs('doctor_dr_house')
  await doctor.get(`/api/patients/${patientId}`)
  const log = await doctor.get(`/api/patients/${patientId}/access-log`)
  return log.body.data.at(-1).eventId
}

beforeAll(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(readFileSync(SCHEMA_PATH, 'utf-8'))

  annaId = Number(
    db
      .prepare('INSERT INTO patients (name, personal_number) VALUES (?, ?)')
      .run('Anna Andersson', '19850101-1234').lastInsertRowid,
  )
  bengtId = Number(
    db
      .prepare('INSERT INTO patients (name, personal_number) VALUES (?, ?)')
      .run('Bengt Berg', '19700512-5678').lastInsertRowid,
  )

  addUser('doctor_dr_house', 'DOCTOR', null)
  addUser('patient_anna', 'PATIENT', annaId)
  addUser('unauth_user', 'UNAUTHORIZED', null)

  blockchain = new Blockchain()
  app = createApp({ db, blockchain, keyPair: generateKeyPair() })
})

afterAll(() => {
  db.close()
})

describe('GET /api/verify/:eventId', () => {
  it('returns a valid proof for an event on the chain, in the agreed shape', async () => {
    const eventId = await eventIdForReadOf(annaId)
    const doctor = await loginAs('doctor_dr_house')

    const res = await doctor.get(`/api/verify/${eventId}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Object.keys(res.body.data).sort()).toEqual(PROOF_FIELDS)
    expect(res.body.data).toMatchObject({ eventId, isValid: true })
    expect(res.body.data.blockHash).toBe(blockchain.chain[res.body.data.blockIndex]?.hash)
  })

  it('does not put the verification itself on the chain', async () => {
    const eventId = await eventIdForReadOf(annaId)
    const doctor = await loginAs('doctor_dr_house')
    const chainBefore = blockchain.chain.length

    await doctor.get(`/api/verify/${eventId}`)

    expect(blockchain.chain.length).toBe(chainBefore)
  })

  it('lets a patient verify an event in their own record', async () => {
    const eventId = await eventIdForReadOf(annaId)
    const anna = await loginAs('patient_anna')

    const res = await anna.get(`/api/verify/${eventId}`)

    expect(res.status).toBe(200)
    expect(res.body.data.isValid).toBe(true)
  })

  it("answers a patient asking about someone else's event as if it did not exist", async () => {
    const eventId = await eventIdForReadOf(bengtId)
    const anna = await loginAs('patient_anna')

    const res = await anna.get(`/api/verify/${eventId}`)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('answers 404 for an event that is not on this node', async () => {
    const doctor = await loginAs('doctor_dr_house')

    const res = await doctor.get(`/api/verify/${randomUUID()}`)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('answers 400 for an id that is not a UUID', async () => {
    const doctor = await loginAs('doctor_dr_house')

    const res = await doctor.get('/api/verify/not-an-id')

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('answers 409 PENDING while the event waits for its block', async () => {
    const batched = new Blockchain({ batchSize: 5 })
    const batchedApp = createApp({ db, blockchain: batched, keyPair: generateKeyPair() })
    const doctor = await loginAs('doctor_dr_house', batchedApp)
    await doctor.get(`/api/patients/${annaId}`)
    const eventId = batched.pending[0]?.id

    const res = await doctor.get(`/api/verify/${eventId}`)

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('PENDING')
  })

  it('refuses an unauthorized user', async () => {
    const stranger = await loginAs('unauth_user')

    const res = await stranger.get(`/api/verify/${randomUUID()}`)

    expect(res.status).toBe(403)
  })

  it('refuses someone who is not signed in', async () => {
    const res = await request(app).get(`/api/verify/${randomUUID()}`)

    expect(res.status).toBe(401)
  })
})
