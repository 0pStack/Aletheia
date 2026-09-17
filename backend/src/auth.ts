import type { Database as DatabaseType } from 'better-sqlite3'
import 'express-session'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export type UserRole = 'DOCTOR' | 'NURSE' | 'CLINIC' | 'PATIENT' | 'UNAUTHORIZED'

export interface SessionUser {
  id: number
  username: string
  name: string
  role: UserRole
  patientId: number | null
}

export interface UserRow {
  id: number
  username: string
  password_hash: string
  name: string
  role: UserRole
  patient_id: number | null
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser
  }
}

const SALT_BYTES = 16
const KEY_LENGTH = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex')
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex')

  return `${salt}:${derivedKey}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':')
  if (parts.length !== 2) {
    return false
  }

  const salt = parts[0]
  const keyHex = parts[1]

  if (!salt || !keyHex) {
    return false
  }

  const keyBuffer = Buffer.from(keyHex, 'hex')
  const derivedBuffer = scryptSync(password, salt, KEY_LENGTH)

  if (keyBuffer.length !== derivedBuffer.length) {
    return false
  }

  return timingSafeEqual(keyBuffer, derivedBuffer)
}

export function findUserByUsername(db: DatabaseType, username: string): UserRow | undefined {
  return db
    .prepare(
      `SELECT id, username, password_hash, name, role, patient_id
       FROM users
       WHERE username = ?`,
    )
    .get(username) as UserRow | undefined
}

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    patientId: row.patient_id,
  }
}
