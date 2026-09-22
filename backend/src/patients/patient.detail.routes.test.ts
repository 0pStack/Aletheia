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
import { hasOnlyAllowedBlockchainPayloadFields } from '../chain/payload-security.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = join(__dirname, '../../db/schema.sql')
const PASSWORD = 'Password123!'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const NOTE_FIELDS = [
  'authorId',
  'authorName',
  'authorRole',
  'createdAt',
  'id',
  'text',
  'visibility',
]

let db: DatabaseType
let app: Express
let blockchain: Blockchain
let annaId: number
let bengtId: number
let doctorId: number

beforeAll(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(readFileSync(SCHEMA_PATH, 'utf-8'))

  const insertPatient = db.prepare('INSERT INTO patients (name, personal_number) VALUES (?, ?)')
  const insertUser = db.prepare(
    `INSERT INTO users (username, password_hash, name, role, patient_id)
     VALUES (?, ?, ?, ?, ?)`,
  )

  annaId = Number(insertPatient.run('Anna Andersson', '19850101-1234').lastInsertRowid)
  bengtId = Number(insertPatient.run('Bengt Berg', '19700512-5678').lastInsertRowid)

  const passwordHash = hashPassword(PASSWORD)

  doctorId = Number(
    insertUser.run('doctor_dr_house', passwordHash, 'Dr. Gregory House', 'DOCTOR', null)
      .lastInsertRowid,
  )

  insertUser.run('patient_anna', passwordHash, 'Anna Andersson', 'PATIENT', annaId)
  insertUser.run('unauth_user', passwordHash, 'Eve Stranded', 'UNAUTHORIZED', null)

  db.prepare(
    `INSERT INTO notes (patient_id, author_id, text, visibility)
     VALUES (?, ?, ?, ?)`,
  ).run(annaId, doctorId, 'Mild fever. Prescribed rest.', 'ALL')

  blockchain = new Blockchain()
  app = createApp({ db, blockchain })
})

afterAll(() => {
  db.close()
})

async function loginAs(username: string) {
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({
    username,
    password: PASSWORD,
  })
  return agent
}

describe('GET /api/patients/:id access', () => {
  it('returns 401 UNAUTHENTICATED without a session', async () => {
    const res = await request(app).get(`/api/patients/${annaId}`)

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 403 FORBIDDEN for an UNAUTHORIZED user', async () => {
    const agent = await loginAs('unauth_user')
    const res = await agent.get(`/api/patients/${annaId}`)

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 404 NOT_FOUND for a patient that does not exist', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get('/api/patients/99999')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.data).toBeNull()
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 BAD_REQUEST for an id that is not a number', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get('/api/patients/abc')

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('returns 403, not 404, when a PATIENT asks for an id that does not exist', async () => {
    const agent = await loginAs('patient_anna')
    const res = await agent.get('/api/patients/99999')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })
})

describe('GET /api/patients/:id response shape', () => {
  it('returns the patient as { id, name, personalNumber }', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get(`/api/patients/${annaId}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.error).toBeNull()
    expect(res.body.data.patient).toEqual({
      id: annaId,
      name: 'Anna Andersson',
      personalNumber: '19850101-1234',
    })
  })

  it('returns notes with the author name, role and an ISO timestamp', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get(`/api/patients/${annaId}`)

    expect(res.body.data.notes[0]).toEqual({
      id: expect.any(Number),
      authorId: doctorId,
      authorName: 'Dr. Gregory House',
      authorRole: 'DOCTOR',
      text: 'Mild fever. Prescribed rest.',
      visibility: 'ALL',
      createdAt: expect.stringMatching(ISO_DATE),
    })
  })

  it('sends no database columns beyond the agreed note fields', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get(`/api/patients/${annaId}`)

    for (const note of res.body.data.notes) {
      expect(Object.keys(note).sort()).toEqual(NOTE_FIELDS)
    }
  })

  it('returns an empty notes array for a patient with no notes', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get(`/api/patients/${bengtId}`)

    expect(res.status).toBe(200)
    expect(res.body.data.notes).toEqual([])
  })
})

describe('blockchain patient data protection', () => {
  it('does not write patient data to the blockchain after a patient read', async () => {
    const agent = await loginAs('doctor_dr_house')

    const res = await agent.get(`/api/patients/${annaId}`)

    expect(res.status).toBe(200)

    expect(hasOnlyAllowedBlockchainPayloadFields(blockchain.chain)).toBe(true)

    const blockchainContent = JSON.stringify(blockchain.chain)

    expect(blockchainContent).not.toContain('Anna Andersson')
    expect(blockchainContent).not.toContain('19850101-1234')
    expect(blockchainContent).not.toContain('Mild fever. Prescribed rest.')
    expect(blockchainContent).not.toContain('Dr. Gregory House')
  })
})
