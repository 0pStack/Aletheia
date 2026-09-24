import Database, { type Database as DatabaseType } from 'better-sqlite3'
import type { Express } from 'express'
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
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const ENTRY_FIELDS = [
  'action',
  'blockIndex',
  'eventId',
  'role',
  'serverId',
  'timestamp',
  'userId',
  'userName',
]

let db: DatabaseType
let app: Express
let blockchain: Blockchain
let annaId: number
let bengtId: number

function addUser(username: string, name: string, role: string, patientId: number | null): number {
  return Number(
    db
      .prepare(
        `INSERT INTO users (username, password_hash, name, role, patient_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(username, hashPassword(PASSWORD), name, role, patientId).lastInsertRowid,
  )
}

async function loginAs(username: string) {
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ username, password: PASSWORD })
  return agent
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

  addUser('doctor_dr_house', 'Dr. Gregory House', 'DOCTOR', null)
  addUser('patient_anna', 'Anna Andersson', 'PATIENT', annaId)
  addUser('unauth_user', 'Eve Stranded', 'UNAUTHORIZED', null)

  blockchain = new Blockchain()
  app = createApp({ db, blockchain, keyPair: generateKeyPair() })
})

afterAll(() => {
  db.close()
})

describe('GET /api/patients/:id/access-log', () => {
  it('shows a doctor who has opened the record, in the agreed shape', async () => {
    const doctor = await loginAs('doctor_dr_house')
    await doctor.get(`/api/patients/${annaId}`)

    const res = await doctor.get(`/api/patients/${annaId}/access-log`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)

    const entry = res.body.data.at(-1)
    expect(entry).toMatchObject({
      userName: 'Dr. Gregory House',
      role: 'DOCTOR',
      action: 'READ',
    })
    expect(entry.timestamp).toMatch(ISO_DATE)
    expect(typeof entry.blockIndex).toBe('number')
    // The patient is the URL, so no patientId leaks into the entry.
    expect(Object.keys(entry).sort()).toEqual(ENTRY_FIELDS)
  })

  it('only reports events for the patient in the URL', async () => {
    const doctor = await loginAs('doctor_dr_house')
    await doctor.get(`/api/patients/${bengtId}`)

    const anna = await doctor.get(`/api/patients/${annaId}/access-log`)
    const bengt = await doctor.get(`/api/patients/${bengtId}/access-log`)

    const annaEvents: string[] = anna.body.data.map((entry: { eventId: string }) => entry.eventId)
    const bengtEvents: string[] = bengt.body.data.map((entry: { eventId: string }) => entry.eventId)

    expect(bengtEvents.length).toBeGreaterThan(0)
    expect(annaEvents.some((id) => bengtEvents.includes(id))).toBe(false)
  })

  it('records a note write as a WRITE entry', async () => {
    const doctor = await loginAs('doctor_dr_house')
    await doctor
      .post(`/api/patients/${annaId}/notes`)
      .send({ text: 'Seen in the log.', visibility: 'STAFF' })

    const res = await doctor.get(`/api/patients/${annaId}/access-log`)

    expect(res.body.data.some((entry: { action: string }) => entry.action === 'WRITE')).toBe(true)
  })

  it('lets a patient read their own access log', async () => {
    const anna = await loginAs('patient_anna')

    const res = await anna.get(`/api/patients/${annaId}/access-log`)

    expect(res.status).toBe(200)
    expect(res.body.data.some((entry: { role: string }) => entry.role === 'DOCTOR')).toBe(true)
  })

  it("refuses a patient another patient's access log, and records the attempt", async () => {
    const anna = await loginAs('patient_anna')
    const chainBefore = blockchain.chain.length

    const res = await anna.get(`/api/patients/${bengtId}/access-log`)

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
    expect(blockchain.chain.length).toBe(chainBefore + 1)
    expect(blockchain.getLatestBlock().data[0]).toMatchObject({
      action: 'DENIED',
      role: 'PATIENT',
      patientId: bengtId,
    })
  })

  it('refuses an unauthorized user', async () => {
    const stranger = await loginAs('unauth_user')

    const res = await stranger.get(`/api/patients/${annaId}/access-log`)

    expect(res.status).toBe(403)
  })

  it('refuses someone who is not signed in', async () => {
    const res = await request(app).get(`/api/patients/${annaId}/access-log`)

    expect(res.status).toBe(401)
  })

  it('answers 404 for a patient that does not exist', async () => {
    const doctor = await loginAs('doctor_dr_house')

    const res = await doctor.get('/api/patients/999999/access-log')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
