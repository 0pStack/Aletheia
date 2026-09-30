import Database, { type Database as DatabaseType } from 'better-sqlite3'
import type { Express } from 'express'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../app.js'
import { hashPassword, type UserRole } from '../auth/auth.js'
import { Blockchain } from '../chain/blockchain.js'
import { generateKeyPair, type KeyPair } from '../chain/keypair.js'

const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../db/schema.sql')

export const PASSWORD = 'Password123!'

export interface TestPatient {
  name: string
  personalNumber: string
}

export interface TestUser {
  username: string
  name: string
  role: UserRole
  patientId?: number | null
}

export interface TestSeedUser extends Omit<TestUser, 'patientId'> {
  // Seeded patients get their ids at insert time, so a seeded user links by personal number.
  patientPersonalNumber?: string
}

export interface TestAppOptions {
  patients?: readonly TestPatient[]
  users?: readonly TestSeedUser[]
}

export interface TestApp {
  app: Express
  db: DatabaseType
  blockchain: Blockchain
  keyPair: KeyPair
  patientId: (personalNumber: string) => number
  userId: (username: string) => number
}

export function createTestDb(): DatabaseType {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(readFileSync(SCHEMA_PATH, 'utf-8'))
  return db
}

export function insertPatient(db: DatabaseType, patient: TestPatient): number {
  return Number(
    db
      .prepare('INSERT INTO patients (name, personal_number) VALUES (?, ?)')
      .run(patient.name, patient.personalNumber).lastInsertRowid,
  )
}

export function insertUser(db: DatabaseType, user: TestUser): number {
  return Number(
    db
      .prepare(
        `INSERT INTO users (username, password_hash, name, role, patient_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(user.username, hashPassword(PASSWORD), user.name, user.role, user.patientId ?? null)
      .lastInsertRowid,
  )
}

function lookup(ids: ReadonlyMap<string, number>, kind: string): (key: string) => number {
  return (key) => {
    const id = ids.get(key)
    if (id === undefined) throw new Error(`No seeded ${kind} for ${key}`)
    return id
  }
}

export function createTestApp(options: TestAppOptions = {}): TestApp {
  const { patients = [], users = [] } = options
  const db = createTestDb()

  const patientIds = new Map(
    patients.map((patient) => [patient.personalNumber, insertPatient(db, patient)] as const),
  )
  const patientId = lookup(patientIds, 'patient')

  const userIds = new Map(
    users.map(({ patientPersonalNumber, ...user }) => {
      const linked = patientPersonalNumber === undefined ? null : patientId(patientPersonalNumber)
      return [user.username, insertUser(db, { ...user, patientId: linked })] as const
    }),
  )

  const blockchain = new Blockchain()
  const keyPair = generateKeyPair()
  const app = createApp({ db, blockchain, keyPair })

  return { app, db, blockchain, keyPair, patientId, userId: lookup(userIds, 'user') }
}
