import Database, { type Database as DatabaseType } from 'better-sqlite3'
import type { Express } from 'express'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { hashPassword } from './auth.js'
import { Blockchain } from './blockchain.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = join(__dirname, '../db/schema.sql')
const PASSWORD = 'Password123!'

let db: DatabaseType
let app: Express
let patientId: number
let otherPatientId: number
let blockchain: Blockchain

beforeAll(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(readFileSync(SCHEMA_PATH, 'utf-8'))

  patientId = Number(
    db
      .prepare('INSERT INTO patients (name, personal_number) VALUES (?, ?)')
      .run('Anna Andersson', '19850101-1234').lastInsertRowid,
  )

  otherPatientId = Number(
    db
      .prepare('INSERT INTO patients (name, personal_number) VALUES (?, ?)')
      .run('Erik Eriksson', '19900101-5678').lastInsertRowid,
  )

  db.prepare(
    `INSERT INTO users (
      username,
      password_hash,
      name,
      role,
      patient_id
    )
    VALUES (?, ?, ?, ?, ?)`,
  ).run('doctor_dr_house', hashPassword(PASSWORD), 'Dr. Gregory House', 'DOCTOR', null)

  db.prepare(
    `INSERT INTO users (
      username,
      password_hash,
      name,
      role,
      patient_id
    )
    VALUES (?, ?, ?, ?, ?)`,
  ).run('patient_anna', hashPassword(PASSWORD), 'Anna Andersson', 'PATIENT', patientId)

  blockchain = new Blockchain()

  app = createApp({ db, blockchain })
})

afterAll(() => {
  db.close()
})

describe('POST /api/patients/:id/notes', () => {
  it('lets a doctor create a note with a visibility level', async () => {
    const agent = request.agent(app)

    await agent.post('/api/auth/login').send({
      username: 'doctor_dr_house',
      password: PASSWORD,
    })

    const res = await agent.post(`/api/patients/${patientId}/notes`).send({
      text: 'Patient is recovering well.',
      visibility: 'STAFF',
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toMatchObject({
      patient_id: patientId,
      text: 'Patient is recovering well.',
      visibility: 'STAFF',
    })
  })

  it('rejects a patient trying to create a note', async () => {
    const agent = request.agent(app)

    await agent.post('/api/auth/login').send({
      username: 'patient_anna',
      password: PASSWORD,
    })

    const res = await agent.post(`/api/patients/${patientId}/notes`).send({
      text: 'Patient tries to create a note.',
      visibility: 'ALL',
    })

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })
})

describe('GET /api/patients/:id', () => {
  it('returns visible notes for a doctor', async () => {
    const doctor = db.prepare(`SELECT id FROM users WHERE username = ?`).get('doctor_dr_house') as {
      id: number
    }

    db.prepare(
      `INSERT INTO notes (
        patient_id,
        author_id,
        text,
        visibility
      )
      VALUES (?, ?, ?, ?)`,
    ).run(patientId, doctor.id, 'Visible staff note', 'STAFF')

    const agent = request.agent(app)

    await agent.post('/api/auth/login').send({
      username: 'doctor_dr_house',
      password: PASSWORD,
    })

    const res = await agent.get(`/api/patients/${patientId}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Visible staff note',
          visibility: 'STAFF',
        }),
      ]),
    )
  })

  it('only returns ALL notes to a patient', async () => {
    const doctor = db.prepare(`SELECT id FROM users WHERE username = ?`).get('doctor_dr_house') as {
      id: number
    }

    const insertNote = db.prepare(
      `INSERT INTO notes (
        patient_id,
        author_id,
        text,
        visibility
      )
      VALUES (?, ?, ?, ?)`,
    )

    insertNote.run(patientId, doctor.id, 'Private doctor note', 'PRIVATE')

    insertNote.run(patientId, doctor.id, 'Staff-only note', 'STAFF')

    insertNote.run(patientId, doctor.id, 'Patient-visible note', 'ALL')

    const agent = request.agent(app)

    await agent.post('/api/auth/login').send({
      username: 'patient_anna',
      password: PASSWORD,
    })

    const res = await agent.get(`/api/patients/${patientId}`)

    expect(res.status).toBe(200)

    const notes = res.body.data.notes

    expect(notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Patient-visible note',
          visibility: 'ALL',
        }),
      ]),
    )

    expect(notes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Private doctor note',
        }),
      ]),
    )

    expect(notes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Staff-only note',
        }),
      ]),
    )
  })

  it('rejects a patient trying to read another patient record', async () => {
    const agent = request.agent(app)

    await agent.post('/api/auth/login').send({
      username: 'patient_anna',
      password: PASSWORD,
    })

    const chainLengthBefore = blockchain.chain.length

    const res = await agent.get(`/api/patients/${otherPatientId}`)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(res.body.data).toBe(null)
    expect(res.body.error.code).toBe('FORBIDDEN')

    expect(blockchain.chain.length).toBe(chainLengthBefore + 1)

    const deniedEvent = blockchain.getLatestBlock().data[0]

    expect(deniedEvent).toMatchObject({
      patientId: otherPatientId,
      role: 'PATIENT',
      action: 'DENIED',
    })
  })
})
