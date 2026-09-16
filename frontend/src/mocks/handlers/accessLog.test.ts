import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { accessLogEntrySchema, sessionUserSchema } from '../../api/schemas'
import { ApiError, request } from '../../api/http'
import { resetMockSession } from '../sessionState'

const accessLogListSchema = z.array(accessLogEntrySchema)

afterEach(() => {
  resetMockSession()
})

function login(username: string, password: string) {
  return request('/api/auth/login', sessionUserSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

describe('GET /api/patients/:id/access-log', () => {
  it('is 401 when nobody is signed in', async () => {
    const error: unknown = await request('/api/patients/p1/access-log', accessLogListSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401 })
  })

  it('is 403 for a role without patient data access', async () => {
    await login('k.holm', 'hunter2')

    const error: unknown = await request('/api/patients/p1/access-log', accessLogListSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403 })
  })

  it('returns the events for that patient', async () => {
    await login('dr.berg', 'hunter2')

    const entries = await request('/api/patients/p1/access-log', accessLogListSchema)

    expect(entries.length).toBeGreaterThan(0)
    expect(entries.every((entry) => entry.patientId === 'p1')).toBe(true)
  })

  it('is 404 for an unknown patient id', async () => {
    await login('dr.berg', 'hunter2')

    const error: unknown = await request(
      '/api/patients/does-not-exist/access-log',
      accessLogListSchema,
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404 })
  })
})
