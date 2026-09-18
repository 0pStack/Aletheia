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
    await login('patient_anna', 'Password123!')

    const error: unknown = await request('/api/patients', patientListSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('is 403 FORBIDDEN for UNAUTHORIZED', async () => {
    await login('unauth_user', 'Password123!')

    const error: unknown = await request('/api/patients', patientListSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns every patient when q is empty', async () => {
    await login('doctor_dr_house', 'Password123!')

    const results = await request('/api/patients', patientListSchema)

    expect(results.length).toBeGreaterThanOrEqual(3)
  })

  it('searches by name, case-insensitively', async () => {
    await login('doctor_dr_house', 'Password123!')

    const results = await request('/api/patients?q=anna', patientListSchema)

    expect(results).toEqual([{ id: 1, name: 'Anna Andersson', personalNumber: '19850101-1234' }])
  })

  it('searches by personal number', async () => {
    await login('doctor_dr_house', 'Password123!')

    const results = await request('/api/patients?q=19700512-5678', patientListSchema)

    expect(results).toEqual([{ id: 2, name: 'Bengt Berg', personalNumber: '19700512-5678' }])
  })
})

describe('GET /api/patients/:id', () => {
  it('is 401 UNAUTHENTICATED when nobody is signed in', async () => {
    const error: unknown = await request('/api/patients/1', patientDetailSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
  })

  it('is 403 FORBIDDEN for UNAUTHORIZED', async () => {
    await login('unauth_user', 'Password123!')

    const error: unknown = await request('/api/patients/1', patientDetailSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('is 403 FORBIDDEN for a PATIENT requesting another patient id', async () => {
    await login('patient_anna', 'Password123!')

    const error: unknown = await request('/api/patients/2', patientDetailSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('gives staff STAFF and ALL notes, plus their own PRIVATE notes only', async () => {
    await login('nurse_jackie', 'Password123!')

    const detail = await request('/api/patients/1', patientDetailSchema)

    expect(detail.patient).toEqual({
      id: 1,
      name: 'Anna Andersson',
      personalNumber: '19850101-1234',
    })
    expect(detail.notes.some((note) => note.visibility === 'STAFF')).toBe(true)
    expect(detail.notes.some((note) => note.visibility === 'ALL')).toBe(true)
    expect(detail.notes.some((note) => note.visibility === 'PRIVATE')).toBe(false)
  })

  it("includes the caller's own PRIVATE notes for staff", async () => {
    await login('doctor_dr_house', 'Password123!')

    const detail = await request('/api/patients/1', patientDetailSchema)

    expect(detail.notes.some((note) => note.visibility === 'PRIVATE' && note.authorId === 1)).toBe(
      true,
    )
  })

  it('returns only ALL-visibility notes for the matching PATIENT', async () => {
    await login('patient_anna', 'Password123!')

    const detail = await request('/api/patients/1', patientDetailSchema)

    expect(detail.patient).toEqual({
      id: 1,
      name: 'Anna Andersson',
      personalNumber: '19850101-1234',
    })
    expect(detail.notes.length).toBeGreaterThan(0)
    expect(detail.notes.every((note) => note.visibility === 'ALL')).toBe(true)
  })

  it('is 404 NOT_FOUND for an unknown patient id', async () => {
    await login('doctor_dr_house', 'Password123!')

    const error: unknown = await request('/api/patients/9999', patientDetailSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })
})
