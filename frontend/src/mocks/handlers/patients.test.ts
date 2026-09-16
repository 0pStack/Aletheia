import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { loginResultSchema, patientDetailSchema, patientSummarySchema } from '../../api/schemas'
import { ApiError, request } from '../../api/http'
import { resetMockSession } from '../sessionState'

const patientListSchema = z.array(patientSummarySchema)

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

describe('GET /api/patients', () => {
  it('is 401 UNAUTHENTICATED when nobody is signed in', async () => {
    const error: unknown = await request('/api/patients', patientListSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
  })

  it('is 403 FORBIDDEN for a PATIENT', async () => {
    await login('a.lindqvist', 'hunter2')

    const error: unknown = await request('/api/patients', patientListSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('is 403 FORBIDDEN for UNAUTHORIZED', async () => {
    await login('k.holm', 'hunter2')

    const error: unknown = await request('/api/patients', patientListSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns every patient when q is empty', async () => {
    await login('dr.berg', 'hunter2')

    const results = await request('/api/patients', patientListSchema)

    expect(results.length).toBeGreaterThanOrEqual(3)
  })

  it('searches by name, case-insensitively', async () => {
    await login('dr.berg', 'hunter2')

    const results = await request('/api/patients?q=astrid', patientListSchema)

    expect(results).toEqual([
      { id: 101, name: 'Astrid Lindqvist', personalNumber: '19000101-0001' },
    ])
  })

  it('searches by personal number', async () => {
    await login('dr.berg', 'hunter2')

    const results = await request('/api/patients?q=19000101-0002', patientListSchema)

    expect(results).toEqual([{ id: 102, name: 'Bo Forsberg', personalNumber: '19000101-0002' }])
  })
})

describe('GET /api/patients/:id', () => {
  it('is 401 UNAUTHENTICATED when nobody is signed in', async () => {
    const error: unknown = await request('/api/patients/101', patientDetailSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
  })

  it('is 403 FORBIDDEN for UNAUTHORIZED', async () => {
    await login('k.holm', 'hunter2')

    const error: unknown = await request('/api/patients/101', patientDetailSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('is 403 FORBIDDEN for a PATIENT requesting another patient id', async () => {
    await login('a.lindqvist', 'hunter2')

    const error: unknown = await request('/api/patients/102', patientDetailSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('gives staff STAFF and ALL notes, plus their own PRIVATE notes only', async () => {
    await login('n.svensson', 'hunter2')

    const detail = await request('/api/patients/101', patientDetailSchema)

    expect(detail.patient).toEqual({
      id: 101,
      name: 'Astrid Lindqvist',
      personalNumber: '19000101-0001',
    })
    expect(detail.notes.some((note) => note.visibility === 'STAFF')).toBe(true)
    expect(detail.notes.some((note) => note.visibility === 'ALL')).toBe(true)
    expect(detail.notes.some((note) => note.visibility === 'PRIVATE')).toBe(false)
  })

  it("includes the caller's own PRIVATE notes for staff", async () => {
    await login('dr.berg', 'hunter2')

    const detail = await request('/api/patients/101', patientDetailSchema)

    expect(detail.notes.some((note) => note.visibility === 'PRIVATE' && note.authorId === 1)).toBe(
      true,
    )
  })

  it('returns only ALL-visibility notes for the matching PATIENT', async () => {
    await login('a.lindqvist', 'hunter2')

    const detail = await request('/api/patients/101', patientDetailSchema)

    expect(detail.patient).toEqual({
      id: 101,
      name: 'Astrid Lindqvist',
      personalNumber: '19000101-0001',
    })
    expect(detail.notes.length).toBeGreaterThan(0)
    expect(detail.notes.every((note) => note.visibility === 'ALL')).toBe(true)
  })

  it('is 404 NOT_FOUND for an unknown patient id', async () => {
    await login('dr.berg', 'hunter2')

    const error: unknown = await request('/api/patients/9999', patientDetailSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })
})
