import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AccessEvent } from '../chain/access-event.js'
import { Blockchain } from '../chain/blockchain.js'
import { collectAccessLog } from './access-log.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = join(__dirname, '../../db/schema.sql')

let db: DatabaseType
let annaId: number
let bengtId: number
let doctorId: number
let nurseId: number

function addPatient(name: string, personalNumber: string): number {
  return Number(
    db
      .prepare('INSERT INTO patients (name, personal_number) VALUES (?, ?)')
      .run(name, personalNumber).lastInsertRowid,
  )
}

function addUser(username: string, name: string, role: string): number {
  return Number(
    db
      .prepare(
        `INSERT INTO users (username, password_hash, name, role, patient_id)
         VALUES (?, ?, ?, ?, NULL)`,
      )
      .run(username, 'not-a-real-hash', name, role).lastInsertRowid,
  )
}

function event(overrides: Partial<AccessEvent> & Pick<AccessEvent, 'id'>): AccessEvent {
  return {
    patientId: annaId,
    userId: doctorId,
    role: 'DOCTOR',
    action: 'READ',
    timestamp: '2026-09-25T10:00:00.000Z',
    serverId: 'node-1',
    ...overrides,
  }
}

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(readFileSync(SCHEMA_PATH, 'utf-8'))

  annaId = addPatient('Anna Andersson', '19850101-1234')
  bengtId = addPatient('Bengt Berg', '19700202-5678')
  doctorId = addUser('doctor', 'Dr. Doktorsson', 'DOCTOR')
  nurseId = addUser('nurse', 'Nils Nurse', 'NURSE')
})

afterEach(() => {
  db.close()
})

describe('collectAccessLog', () => {
  it('returns an empty log when the chain holds only the genesis block', () => {
    expect(collectAccessLog(db, new Blockchain(), annaId)).toEqual([])
  })

  it('maps each event to an entry with the user name and its block index', () => {
    const blockchain = new Blockchain()
    blockchain.addBlock([event({ id: 'e1', action: 'WRITE', serverId: 'node-2' })])

    expect(collectAccessLog(db, blockchain, annaId)).toEqual([
      {
        eventId: 'e1',
        userId: doctorId,
        userName: 'Dr. Doktorsson',
        role: 'DOCTOR',
        action: 'WRITE',
        timestamp: '2026-09-25T10:00:00.000Z',
        serverId: 'node-2',
        blockIndex: 1,
      },
    ])
  })

  it('leaves out events that belong to other patients', () => {
    const blockchain = new Blockchain()
    blockchain.addBlock([
      event({ id: 'anna-1' }),
      event({ id: 'bengt-1', patientId: bengtId }),
      event({ id: 'anna-2', userId: nurseId, role: 'NURSE' }),
    ])

    const ids = collectAccessLog(db, blockchain, annaId).map((entry) => entry.eventId)

    expect(ids).toEqual(['anna-1', 'anna-2'])
  })

  it('keeps chain order across blocks and records which block each event is in', () => {
    const blockchain = new Blockchain()
    blockchain.addBlock([event({ id: 'e1' })])
    blockchain.addBlock([event({ id: 'other', patientId: bengtId })])
    blockchain.addBlock([event({ id: 'e2', userId: nurseId, role: 'NURSE' }), event({ id: 'e3' })])

    const log = collectAccessLog(db, blockchain, annaId)

    expect(log.map(({ eventId, blockIndex }) => ({ eventId, blockIndex }))).toEqual([
      { eventId: 'e1', blockIndex: 1 },
      { eventId: 'e2', blockIndex: 3 },
      { eventId: 'e3', blockIndex: 3 },
    ])
  })

  it('joins the right name to each user when several users appear', () => {
    const blockchain = new Blockchain()
    blockchain.addBlock([
      event({ id: 'e1' }),
      event({ id: 'e2', userId: nurseId, role: 'NURSE' }),
      event({ id: 'e3' }),
    ])

    const names = collectAccessLog(db, blockchain, annaId).map(({ userId, userName }) => ({
      userId,
      userName,
    }))

    expect(names).toEqual([
      { userId: doctorId, userName: 'Dr. Doktorsson' },
      { userId: nurseId, userName: 'Nils Nurse' },
      { userId: doctorId, userName: 'Dr. Doktorsson' },
    ])
  })

  it('falls back to "Unknown user" when the user id is not in the database', () => {
    const blockchain = new Blockchain()
    blockchain.addBlock([event({ id: 'e1', userId: 9999, role: 'UNAUTHORIZED', action: 'DENIED' })])

    const [entry] = collectAccessLog(db, blockchain, annaId)

    expect(entry?.userName).toBe('Unknown user')
    expect(entry?.userId).toBe(9999)
  })

  it('does not include events still pending a block', () => {
    const blockchain = new Blockchain({ batchSize: 10 })
    blockchain.addEvent(event({ id: 'pending' }))

    expect(collectAccessLog(db, blockchain, annaId)).toEqual([])
  })

  it('does not expose signature or public key fields', () => {
    const blockchain = new Blockchain()
    blockchain.addBlock([event({ id: 'e1', signature: 'sig', publicKey: 'key' })])

    const [entry] = collectAccessLog(db, blockchain, annaId)

    expect(Object.keys(entry ?? {}).sort()).toEqual([
      'action',
      'blockIndex',
      'eventId',
      'role',
      'serverId',
      'timestamp',
      'userId',
      'userName',
    ])
  })
})
