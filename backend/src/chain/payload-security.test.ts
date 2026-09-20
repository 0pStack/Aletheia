import { describe, expect, it } from 'vitest'
import { hasOnlyAllowedAccessEventFields } from './payload-security.js'

describe('blockchain payload security', () => {
  it('rejects an access event containing a non-whitelisted field', () => {
    const unsafeEvent = {
      id: 'event-1',
      patientId: 101,
      userId: 5,
      role: 'DOCTOR',
      action: 'READ',
      timestamp: '2026-09-17T10:00:00.000Z',
      serverId: 'server-1',
      journalText: 'Sensitive patient information',
    }

    expect(hasOnlyAllowedAccessEventFields(unsafeEvent)).toBe(false)
  })

  it('allows an access event containing only whitelisted fields', () => {
    const safeEvent = {
      id: 'event-1',
      patientId: 101,
      userId: 5,
      role: 'DOCTOR',
      action: 'READ',
      timestamp: '2026-09-17T10:00:00.000Z',
      serverId: 'server-1',
      signature: 'signature',
      publicKey: 'public-key',
    }

    expect(hasOnlyAllowedAccessEventFields(safeEvent)).toBe(true)
  })
})
