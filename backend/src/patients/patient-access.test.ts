import type { Request } from 'express'
import { describe, expect, it } from 'vitest'
import type { SessionUser } from '../auth/auth.js'
import { Blockchain } from '../chain/blockchain.js'
import { generateKeyPair } from '../chain/keypair.js'
import { parsePatientId, refuseOtherPatientsRecord } from './patient-access.js'

const keyPair = generateKeyPair()

function loggedEvents(blockchain: Blockchain) {
  return blockchain.chain.flatMap((block) => block.data)
}

function requestFrom(user: SessionUser): Request {
  return { session: { user } } as unknown as Request
}

const patient: SessionUser = {
  id: 7,
  username: 'patient',
  name: 'Pat',
  role: 'PATIENT',
  patientId: 12,
}

const doctor: SessionUser = {
  id: 42,
  username: 'doctor',
  name: 'Doc',
  role: 'DOCTOR',
  patientId: null,
}

describe('parsePatientId', () => {
  it.each([
    ['1', 1],
    ['736251', 736251],
    [' 5 ', 5],
  ])('accepts %j as %d', (raw, expected) => {
    expect(parsePatientId(raw)).toBe(expected)
  })

  it.each(['0', '-3', '1.5', 'abc', '', 'NaN', 'Infinity', undefined])('rejects %j', (raw) => {
    expect(parsePatientId(raw)).toBeUndefined()
  })
})

describe('refuseOtherPatientsRecord', () => {
  it('lets a patient through to their own record without logging', () => {
    const blockchain = new Blockchain()

    expect(refuseOtherPatientsRecord(requestFrom(patient), blockchain, keyPair, 12)).toBe(false)
    expect(loggedEvents(blockchain)).toHaveLength(0)
  })

  it('refuses a patient asking for someone else and logs DENIED against that record', () => {
    const blockchain = new Blockchain()

    expect(refuseOtherPatientsRecord(requestFrom(patient), blockchain, keyPair, 13)).toBe(true)
    expect(loggedEvents(blockchain)).toEqual([
      expect.objectContaining({ patientId: 13, userId: 7, role: 'PATIENT', action: 'DENIED' }),
    ])
  })

  it('leaves staff alone, whatever record they ask for', () => {
    const blockchain = new Blockchain()

    expect(refuseOtherPatientsRecord(requestFrom(doctor), blockchain, keyPair, 13)).toBe(false)
    expect(loggedEvents(blockchain)).toHaveLength(0)
  })
})
