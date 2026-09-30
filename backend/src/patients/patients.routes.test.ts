import type { Database as DatabaseType } from 'better-sqlite3'
import type { Express } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, PASSWORD } from '../test-support/test-app.js'

let db: DatabaseType
let app: Express
let annaId: number

beforeAll(() => {
  const fixture = createTestApp({
    patients: [
      { name: 'Anna Andersson', personalNumber: '19850101-1234' },
      { name: 'Bengt Berg', personalNumber: '19700512-5678' },
      { name: 'Cecilia Carlsson', personalNumber: '19921130-9012' },
      { name: '100% Test Patient', personalNumber: '19600101-0001' },
    ],
    users: [
      { username: 'doctor_dr_house', name: 'Dr. Gregory House', role: 'DOCTOR' },
      { username: 'nurse_jackie', name: 'Jackie Peyton', role: 'NURSE' },
      { username: 'clinic_admin', name: 'City Central Clinic', role: 'CLINIC' },
      {
        username: 'patient_anna',
        name: 'Anna Andersson',
        role: 'PATIENT',
        patientPersonalNumber: '19850101-1234',
      },
      { username: 'unauth_user', name: 'Eve Stranded', role: 'UNAUTHORIZED' },
    ],
  })

  db = fixture.db
  app = fixture.app
  annaId = fixture.patientId('19850101-1234')
})

afterAll(() => {
  db.close()
})

async function loginAs(username: string) {
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ username, password: PASSWORD })
  return agent
}

function namesOf(res: request.Response): string[] {
  return res.body.data.map((patient: { name: string }) => patient.name)
}

describe('GET /api/patients access', () => {
  it('returns 401 UNAUTHENTICATED without a session', async () => {
    const res = await request(app).get('/api/patients?q=anna')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 403 FORBIDDEN for a PATIENT', async () => {
    const agent = await loginAs('patient_anna')
    const res = await agent.get('/api/patients?q=anna')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 403 FORBIDDEN for an UNAUTHORIZED user', async () => {
    const agent = await loginAs('unauth_user')
    const res = await agent.get('/api/patients?q=anna')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('allows a NURSE to search', async () => {
    const agent = await loginAs('nurse_jackie')
    const res = await agent.get('/api/patients?q=anna')

    expect(res.status).toBe(200)
  })

  it('allows a CLINIC to search', async () => {
    const agent = await loginAs('clinic_admin')
    const res = await agent.get('/api/patients?q=anna')

    expect(res.status).toBe(200)
  })
})

describe('GET /api/patients search', () => {
  it('lists patients sorted by name when q is left out', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get('/api/patients')

    expect(res.status).toBe(200)
    const names = namesOf(res)
    expect(names).toEqual([...names].sort())
    expect(names).toContain('Anna Andersson')
  })

  it('caps the unfiltered list at 50 patients', async () => {
    const insert = db.prepare('INSERT INTO patients (name, personal_number) VALUES (?, ?)')
    const added = Array.from({ length: 60 }, (_, index) =>
      Number(
        insert.run(`Zz Bulk ${index}`, `20000101-${String(index).padStart(4, '0')}`)
          .lastInsertRowid,
      ),
    )
    const agent = await loginAs('doctor_dr_house')

    const res = await agent.get('/api/patients')

    const removeAdded = db.prepare('DELETE FROM patients WHERE id = ?')
    added.forEach((id) => removeAdded.run(id))
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(50)
  })

  it('still refuses the unfiltered list to a PATIENT', async () => {
    const agent = await loginAs('patient_anna')
    const res = await agent.get('/api/patients')

    expect(res.status).toBe(403)
  })

  it('returns 400 BAD_REQUEST when q is given more than once', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get('/api/patients?q=anna&q=bengt')

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('returns 400 BAD_REQUEST when q is only whitespace', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get('/api/patients?q=%20%20')

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('finds a patient by part of the name', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get('/api/patients?q=anders')

    expect(res.status).toBe(200)
    expect(namesOf(res)).toEqual(['Anna Andersson'])
  })

  it('matches the name regardless of case', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get('/api/patients?q=BENGT')

    expect(namesOf(res)).toEqual(['Bengt Berg'])
  })

  it('finds a patient by personal number', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get('/api/patients?q=19921130-9012')

    expect(namesOf(res)).toEqual(['Cecilia Carlsson'])
  })

  it('finds a patient by personal number typed without the dash', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get('/api/patients?q=199211309012')

    expect(namesOf(res)).toEqual(['Cecilia Carlsson'])
  })

  it('returns every match, sorted by name', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get('/api/patients?q=e')

    const names = namesOf(res)
    expect(names).toContain('Bengt Berg')
    expect(names).toContain('Cecilia Carlsson')
    expect(names).toEqual([...names].sort())
  })

  it('returns an empty array when nothing matches', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get('/api/patients?q=zzzzz')

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('treats a percent sign as text rather than a wildcard', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get('/api/patients?q=%25')

    expect(namesOf(res)).toEqual(['100% Test Patient'])
  })

  it('returns each patient as { id, name, personalNumber }', async () => {
    const agent = await loginAs('doctor_dr_house')
    const res = await agent.get('/api/patients?q=anna')

    expect(res.body.data[0]).toEqual({
      id: annaId,
      name: 'Anna Andersson',
      personalNumber: '19850101-1234',
    })
  })
})
