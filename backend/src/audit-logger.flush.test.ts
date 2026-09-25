import type { Request } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { auditLogFailures, logAccessEvent, reportFlushFailure } from './audit-logger.js'
import { Blockchain } from './chain/blockchain.js'
import { generateKeyPair } from './chain/keypair.js'

const keyPair = generateKeyPair()
const PATIENT_ID = 736251

let consoleError: MockInstance<typeof console.error>

beforeEach(() => {
  vi.useFakeTimers()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  consoleError.mockRestore()
})

function doctorRequest(): Request {
  return {
    session: {
      user: { id: 42, username: 'doctor', name: 'Doc', role: 'DOCTOR', patientId: null },
    },
  } as unknown as Request
}

function loggedText(): string {
  return consoleError.mock.calls
    .flat()
    .map((arg) =>
      typeof arg === 'object' && !(arg instanceof Error) ? JSON.stringify(arg) : String(arg),
    )
    .join(' ')
}

function batchingChainWithBrokenDisk(): Blockchain {
  return new Blockchain({
    batchSize: 5,
    flushIntervalMs: 2000,
    onBlockAdded: () => {
      throw new Error('EIO: i/o error')
    },
    onFlushError: reportFlushFailure,
  })
}

describe('a deferred flush that cannot save the chain', () => {
  it('does not crash the process', () => {
    const blockchain = batchingChainWithBrokenDisk()

    logAccessEvent(doctorRequest(), blockchain, PATIENT_ID, 'READ', keyPair)

    expect(() => vi.advanceTimersByTime(2000)).not.toThrow()
  })

  it('counts every event in the batch and raises an alert for refused ones', () => {
    const blockchain = batchingChainWithBrokenDisk()
    const before = auditLogFailures()

    logAccessEvent(doctorRequest(), blockchain, PATIENT_ID, 'DENIED', keyPair)
    logAccessEvent(doctorRequest(), blockchain, PATIENT_ID, 'READ', keyPair)
    logAccessEvent(doctorRequest(), blockchain, PATIENT_ID, 'DENIED', keyPair)

    expect(auditLogFailures()).toBe(before)

    vi.advanceTimersByTime(2000)

    const after = auditLogFailures()
    expect(after.count).toBe(before.count + 3)
    expect(after.deniedCount).toBe(before.deniedCount + 2)
    expect(after.lastFailureAt).not.toBeNull()
    expect(loggedText()).toMatch(/ALERT/)
    expect(loggedText()).toMatch(/EIO/)
  })

  it('keeps the patient out of the server log', () => {
    const blockchain = batchingChainWithBrokenDisk()

    logAccessEvent(doctorRequest(), blockchain, PATIENT_ID, 'DENIED', keyPair)
    vi.advanceTimersByTime(2000)

    expect(consoleError).toHaveBeenCalled()
    expect(loggedText()).not.toContain(String(PATIENT_ID))
  })

  it('does not raise the refused-access alert for a batch without refusals', () => {
    const blockchain = batchingChainWithBrokenDisk()
    const before = auditLogFailures()

    logAccessEvent(doctorRequest(), blockchain, PATIENT_ID, 'WRITE', keyPair)
    vi.advanceTimersByTime(2000)

    expect(auditLogFailures().deniedCount).toBe(before.deniedCount)
    expect(loggedText()).not.toMatch(/ALERT/)
  })
})
