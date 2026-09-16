import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { patientDetailSchema, patientSummarySchema, sessionUserSchema } from '../../api/schemas'
import { ApiError, request } from '../../api/http'
import { resetMockSession } from '../sessionState'

const patientListSchema = z.array(patientSummarySchema)

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

describe('GET /api/patients', () => {
  it('is 401 when nobody is signed in', async () => {
    const error: unknown = await request('/api/patients', patientListSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401 })
  })

  it('is 403 for a role without patient data access', async () => {
    await login('k.holm', 'hunter2')

    const error: unknown = await request('/api/patients', patientListSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403 })
  })

  it('returns every patient when q is empty', async () => {
    await login('dr.berg', 'hunter2')

    const results = await request('/api/patients', patientListSchema)

    expect(results.length).toBeGreaterThanOrEqual(3)
  })

  it('searches by name, case-insensitively', async () => {
    await login('dr.berg', 'hunter2')

    const results = await request('/api/patients?q=astrid', patientListSchema)

    expect(results).toEqual([{ id: 'p1', name: 'Astrid Lindqvist' }])
  })

  it('searches by id', async () => {
    await login('dr.berg', 'hunter2')

    const results = await request('/api/patients?q=p2', patientListSchema)

    expect(results).toEqual([{ id: 'p2', name: 'Bo Fors' }])
  })
})

describe('GET /api/patients/:id', () => {
  it('is 401 when nobody is signed in', async () => {
    const error: unknown = await request('/api/patients/p1', patientDetailSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401 })
  })

  it('is 403 for a role without patient data access', async () => {
    await login('k.holm', 'hunter2')

    const error: unknown = await request('/api/patients/p1', patientDetailSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403 })
  })

  it('returns the patient with their notes', async () => {
    await login('dr.berg', 'hunter2')

    const detail = await request('/api/patients/p1', patientDetailSchema)

    expect(detail.patient).toEqual({ id: 'p1', name: 'Astrid Lindqvist' })
    expect(detail.notes.length).toBeGreaterThan(0)
    expect(detail.notes.every((note) => note.patientId === 'p1')).toBe(true)
  })

  it('is 404 for an unknown patient id', async () => {
    await login('dr.berg', 'hunter2')

    const error: unknown = await request('/api/patients/does-not-exist', patientDetailSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404 })
  })
})
