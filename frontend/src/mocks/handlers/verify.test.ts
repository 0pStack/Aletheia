import { afterEach, describe, expect, it } from 'vitest'
import { eventProofSchema, loginResultSchema } from '../../api/schemas'
import { ApiError, request } from '../../api/http'
import { resetMockSession } from '../sessionState'

const ANNA_EVENT = '11111111-1111-4111-8111-111111111111'
const OTHER_PATIENT_EVENT = '33333333-3333-4333-8333-333333333333'
const UNKNOWN_EVENT = '99999999-9999-4999-8999-999999999999'

afterEach(() => {
  resetMockSession()
})

function login(username: string) {
  return request('/api/auth/login', loginResultSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'Password123!' }),
  })
}

function verifyError(eventId: string): Promise<unknown> {
  return request(`/api/verify/${eventId}`, eventProofSchema).catch((caught: unknown) => caught)
}

describe('GET /api/verify/:eventId', () => {
  it('is 401 UNAUTHENTICATED when nobody is signed in', async () => {
    const error = await verifyError(ANNA_EVENT)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
  })

  it('is 403 FORBIDDEN for UNAUTHORIZED', async () => {
    await login('unauth_user')

    expect(await verifyError(ANNA_EVENT)).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('is 400 BAD_REQUEST when the id is not a UUID', async () => {
    await login('doctor_dr_house')

    expect(await verifyError('not-a-uuid')).toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('is 404 NOT_FOUND for an unknown event', async () => {
    await login('doctor_dr_house')

    expect(await verifyError(UNKNOWN_EVENT)).toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('is 404, not 403, for a PATIENT asking about another patient’s event', async () => {
    await login('patient_anna')

    expect(await verifyError(OTHER_PATIENT_EVENT)).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  it('returns a valid proof for the event to staff', async () => {
    await login('doctor_dr_house')

    const proof = await request(`/api/verify/${ANNA_EVENT}`, eventProofSchema)

    expect(proof).toMatchObject({ eventId: ANNA_EVENT, blockIndex: 1, isValid: true })
  })

  it('returns a proof to the PATIENT whose record holds the event', async () => {
    await login('patient_anna')

    const proof = await request(`/api/verify/${ANNA_EVENT}`, eventProofSchema)

    expect(proof.isValid).toBe(true)
  })
})
