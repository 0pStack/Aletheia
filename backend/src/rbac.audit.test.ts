import Database, { type Database as DatabaseType } from 'better-sqlite3'
import type { Express } from 'express'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import { hashPassword } from './auth/auth.js'
import { verifyAccessEvent } from './chain/access-event-signing.js'
import { Blockchain } from './chain/blockchain.js'
import { generateKeyPair } from './chain/keypair.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = join(__dirname, '../db/schema.sql')
const PASSWORD = 'Password123!'

let db: DatabaseType
let app: Express
let blockchain: Blockchain
let patientId: number

async function loginAs(username: string) {
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ username, password: PASSWORD })
  return agent
}

beforeAll(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(readFileSync(SCHEMA_PATH, 'utf-8'))

  patientId = Number(
    db
      .prepare('INSERT INTO patients (name, personal_number) VALUES (?, ?)')
      .run('Anna Andersson', '19850101-1234').lastInsertRowid,
  )

  for (const [username, name, role] of [
    ['unauth_user', 'Eve Stranded', 'UNAUTHORIZED'],
    ['doctor_dr_house', 'Dr. Gregory House', 'DOCTOR'],
  ]) {
    db.prepare(
      `INSERT INTO users (username, password_hash, name, role, patient_id)
       VALUES (?, ?, ?, ?, NULL)`,
    ).run(username, hashPassword(PASSWORD), name, role)
  }

  blockchain = new Blockchain()
  app = createApp({ db, blockchain, keyPair: generateKeyPair() })
})

afterAll(() => {
  db.close()
})

describe('a refused attempt on a patient', () => {
  it('is recorded on the chain, naming who tried', async () => {
    const stranger = await loginAs('unauth_user')
    const lengthBefore = blockchain.chain.length

    const res = await stranger.get(`/api/patients/${patientId}`)

    expect(res.status).toBe(403)
    expect(blockchain.chain.length).toBe(lengthBefore + 1)
    expect(blockchain.getLatestBlock().data[0]).toMatchObject({
      patientId,
      role: 'UNAUTHORIZED',
      action: 'DENIED',
    })
  })

  it('is signed, like every other access event', async () => {
    const stranger = await loginAs('unauth_user')

    await stranger.get(`/api/patients/${patientId}`)

    const event = blockchain.getLatestBlock().data[0]
    expect(event && verifyAccessEvent(event)).toBe(true)
  })

  it('records nothing against a patient id that belongs to no one', async () => {
    const stranger = await loginAs('unauth_user')
    const lengthBefore = blockchain.chain.length

    const res = await stranger.get('/api/patients/999999')

    expect(res.status).toBe(403)
    // Otherwise a refused account could write chosen entries into any record it named,
    // and the chain keeps them for good.
    expect(blockchain.chain.length).toBe(lengthBefore)
  })

  it('records nothing when nobody is signed in', async () => {
    const lengthBefore = blockchain.chain.length

    const res = await request(app).get(`/api/patients/${patientId}`)

    expect(res.status).toBe(401)
    expect(blockchain.chain.length).toBe(lengthBefore)
  })

  it('records nothing for a refused search, which names no patient', async () => {
    const stranger = await loginAs('unauth_user')
    const lengthBefore = blockchain.chain.length

    const res = await stranger.get('/api/patients?q=andersson')

    expect(res.status).toBe(403)
    expect(blockchain.chain.length).toBe(lengthBefore)
  })
})

describe('a refused attempt when the node cannot sign', () => {
  it('is still refused, and the failure is logged', async () => {
    const brokenChain = new Blockchain()
    const brokenApp = createApp({
      db,
      blockchain: brokenChain,
      keyPair: { publicKey: 'not a key', privateKey: 'not a key' },
    })
    const stranger = request.agent(brokenApp)
    await stranger.post('/api/auth/login').send({ username: 'unauth_user', password: PASSWORD })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const res = await stranger.get(`/api/patients/${patientId}`)

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
      expect(consoleError).toHaveBeenCalled()
      // Nothing half-written: an unsigned event must never reach the chain.
      expect(brokenChain.chain.length).toBe(1)
      expect(brokenChain.pending).toHaveLength(0)
    } finally {
      consoleError.mockRestore()
    }
  })
})
