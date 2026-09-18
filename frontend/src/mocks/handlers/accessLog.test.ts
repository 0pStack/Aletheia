import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { accessLogEntrySchema, loginResultSchema } from '../../api/schemas'
import { ApiError, request } from '../../api/http'
import { resetMockSession } from '../sessionState'

const accessLogListSchema = z.array(accessLogEntrySchema)

afterEach(() => {
  resetMockSession()
})

function login(username: string, password: string) {
  return request('/api/auth/login', loginResultSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

describe('GET /api/patients/:id/access-log', () => {
  it('is 401 UNAUTHENTICATED when nobody is signed in', async () => {
    const error: unknown = await request('/api/patients/1/access-log', accessLogListSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
  })

  it('is 403 FORBIDDEN for UNAUTHORIZED', async () => {
    await login('unauth_user', 'Password123!')

    const error: unknown = await request('/api/patients/1/access-log', accessLogListSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('is 403 FORBIDDEN for a PATIENT requesting another patient id', async () => {
    await login('patient_anna', 'Password123!')

    const error: unknown = await request('/api/patients/2/access-log', accessLogListSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns the events for that patient to staff', async () => {
    await login('doctor_dr_house', 'Password123!')

    const entries = await request('/api/patients/1/access-log', accessLogListSchema)

    expect(entries.length).toBeGreaterThan(0)
    expect(entries.every((entry) => typeof entry.eventId === 'string')).toBe(true)
  })

  it('returns the events for the matching PATIENT', async () => {
    await login('patient_anna', 'Password123!')

    const entries = await request('/api/patients/1/access-log', accessLogListSchema)

    expect(entries.length).toBeGreaterThan(0)
  })

  it('is 404 NOT_FOUND for an unknown patient id', async () => {
    await login('doctor_dr_house', 'Password123!')

    const error: unknown = await request(
      '/api/patients/9999/access-log',
      accessLogListSchema,
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })
})
