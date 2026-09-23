import { describe, expect, it } from 'vitest'
import type { SessionUser } from '../../api/schemas'
import { getJournalAccess } from './journalAccess'

const doctor: SessionUser = {
  id: 1,
  username: 'doctor_dr_house',
  name: 'Dr. Gregory House',
  role: 'DOCTOR',
  patientId: null,
}

const anna: SessionUser = {
  id: 4,
  username: 'patient_anna',
  name: 'Anna Andersson',
  role: 'PATIENT',
  patientId: 1,
}

// Every deny path lands on exactly this: nothing offered, nothing labelled.
const DENIED = {
  isStaff: false,
  isOwnRecord: false,
  canWriteNotes: false,
  canSeeVisibilityLabels: false,
}

describe('getJournalAccess', () => {
  it('lets staff write notes and read the access log of any patient', () => {
    const access = getJournalAccess(doctor, 2)

    expect(access).toEqual({
      isStaff: true,
      isOwnRecord: false,
      canWriteNotes: true,
      canSeeVisibilityLabels: true,
    })
  })

  it('gives every staff role the same journal access', () => {
    for (const role of ['DOCTOR', 'NURSE', 'CLINIC'] as const) {
      expect(getJournalAccess({ ...doctor, role }, 1).canWriteNotes).toBe(true)
    }
  })

  it('lets a patient read their own record without writing or labels', () => {
    const access = getJournalAccess(anna, 1)

    expect(access).toEqual({
      isStaff: false,
      isOwnRecord: true,
      canWriteNotes: false,
      canSeeVisibilityLabels: false,
    })
  })

  it('grants a patient nothing on someone else’s record', () => {
    const access = getJournalAccess(anna, 2)

    expect(access).toEqual(DENIED)
  })

  it('grants nothing to an unauthorized user', () => {
    const access = getJournalAccess({ ...doctor, role: 'UNAUTHORIZED' }, 1)

    expect(access).toEqual(DENIED)
  })

  it('grants nothing while the session or the patient id is still missing', () => {
    expect(getJournalAccess(undefined, 1)).toEqual(DENIED)
    expect(getJournalAccess(doctor, null)).toEqual(DENIED)
  })
})
