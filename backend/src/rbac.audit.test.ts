import type { Database as DatabaseType } from 'better-sqlite3'
import type { Express } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import { verifyAccessEvent } from './chain/access-event-signing.js'
import { Blockchain } from './chain/blockchain.js'
import { createTestApp, PASSWORD } from './test-support/test-app.js'

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
  const fixture = createTestApp({
    patients: [{ name: 'Anna Andersson', personalNumber: '19850101-1234' }],
    users: [
      { username: 'unauth_user', name: 'Eve Stranded', role: 'UNAUTHORIZED' },
      { username: 'doctor_dr_house', name: 'Dr. Gregory House', role: 'DOCTOR' },
    ],
  })

  db = fixture.db
  app = fixture.app
  blockchain = fixture.blockchain
  patientId = fixture.patientId('19850101-1234')
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
