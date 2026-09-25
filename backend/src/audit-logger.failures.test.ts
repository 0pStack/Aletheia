import type { Request } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { auditLogFailures, logAccessEvent } from './audit-logger.js'
import { Blockchain } from './chain/blockchain.js'
import { generateKeyPair, type KeyPair } from './chain/keypair.js'

const keyPair = generateKeyPair()
const brokenKeyPair: KeyPair = { publicKey: keyPair.publicKey, privateKey: 'not a key' }
const PATIENT_ID = 918273

let consoleError: MockInstance<typeof console.error>

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleError.mockRestore()
})

function doctorRequest(): Request {
  return {
    session: {
      user: { id: 42, username: 'doctor', name: 'Doc', role: 'DOCTOR', patientId: null },
    },
  } as unknown as Request
}

function anonymousRequest(): Request {
  return { session: {} } as unknown as Request
}

function loggedText(): string {
  return consoleError.mock.calls
    .flat()
    .map((arg) =>
      typeof arg === 'object' && !(arg instanceof Error) ? JSON.stringify(arg) : String(arg),
    )
    .join(' ')
}

describe('logAccessEvent without a session user', () => {
  it('throws instead of dropping the event silently', () => {
    const blockchain = new Blockchain()

    expect(() =>
      logAccessEvent(anonymousRequest(), blockchain, PATIENT_ID, 'DENIED', keyPair),
    ).toThrow(/session user/i)
    expect(blockchain.pending).toHaveLength(0)
  })

  it('reports the failure on the server and counts it', () => {
    const before = auditLogFailures().count

    expect(() =>
      logAccessEvent(anonymousRequest(), new Blockchain(), PATIENT_ID, 'READ', keyPair),
    ).toThrow()

    expect(consoleError).toHaveBeenCalled()
    expect(loggedText()).toMatch(/READ/)
    expect(auditLogFailures().count).toBe(before + 1)
  })
})

describe('logAccessEvent when the event cannot be recorded', () => {
  it('still lets the caller see the error', () => {
    expect(() =>
      logAccessEvent(doctorRequest(), new Blockchain(), PATIENT_ID, 'READ', brokenKeyPair),
    ).toThrow()
  })

  it('raises a loud alert for a refused access that did not reach the chain', () => {
    const before = auditLogFailures()

    expect(() =>
      logAccessEvent(doctorRequest(), new Blockchain(), PATIENT_ID, 'DENIED', brokenKeyPair),
    ).toThrow()

    const after = auditLogFailures()
    expect(after.count).toBe(before.count + 1)
    expect(after.deniedCount).toBe(before.deniedCount + 1)
    expect(after.lastFailureAt).not.toBeNull()
    expect(loggedText()).toMatch(/refused access/i)
    expect(loggedText()).toMatch(/DOCTOR/)
  })

  it('counts a failure of the chain itself', () => {
    const blockchain = new Blockchain()
    vi.spyOn(blockchain, 'addEvent').mockImplementation(() => {
      throw new Error('disk full')
    })
    const before = auditLogFailures().count

    expect(() => logAccessEvent(doctorRequest(), blockchain, PATIENT_ID, 'WRITE', keyPair)).toThrow(
      'disk full',
    )
    expect(auditLogFailures().count).toBe(before + 1)
  })

  it('keeps the patient out of the server log', () => {
    expect(() =>
      logAccessEvent(doctorRequest(), new Blockchain(), PATIENT_ID, 'DENIED', brokenKeyPair),
    ).toThrow()

    expect(loggedText()).not.toContain(String(PATIENT_ID))
  })

  it('does not let a caller change the reported numbers', () => {
    const snapshot = auditLogFailures()

    expect(Object.isFrozen(snapshot)).toBe(true)
  })
})

describe('logAccessEvent when recording succeeds', () => {
  it('counts nothing and logs nothing', () => {
    const before = auditLogFailures().count

    logAccessEvent(doctorRequest(), new Blockchain(), PATIENT_ID, 'READ', keyPair)

    expect(auditLogFailures().count).toBe(before)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
