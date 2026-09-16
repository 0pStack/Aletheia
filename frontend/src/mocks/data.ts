// Fake data for the mock API (issue #6). Paths, shapes and roles below are assumptions
// until issue #3 agrees the real ones — see docs/current-work.md, sections #3 and #6.

export type Role = 'clinician' | 'billing'

// Roles allowed to reach patient data (search, patient detail, access log).
// 'billing' exists only to produce a 403 in the mock layer.
export const PATIENT_DATA_ROLES: readonly Role[] = ['clinician']

export interface MockUser {
  readonly id: string
  readonly username: string
  readonly password: string
  readonly name: string
  readonly role: Role
}

export const mockUsers: readonly MockUser[] = [
  { id: 'u1', username: 'dr.berg', password: 'hunter2', name: 'Dr. Berg', role: 'clinician' },
  {
    id: 'u2',
    username: 'n.svensson',
    password: 'hunter2',
    name: 'Nurse Svensson',
    role: 'clinician',
  },
  { id: 'u3', username: 'k.holm', password: 'hunter2', name: 'K. Holm', role: 'billing' },
]

export interface MockPatient {
  readonly id: string
  readonly name: string
}

export const mockPatients: readonly MockPatient[] = [
  { id: 'p1', name: 'Astrid Lindqvist' },
  { id: 'p2', name: 'Bo Fors' },
  { id: 'p3', name: 'Chana Okafor' },
]

export interface MockNote {
  readonly id: string
  readonly patientId: string
  readonly authorName: string
  readonly text: string
  readonly visibility: 'standard'
  readonly createdAt: string
}

export const mockNotes: readonly MockNote[] = [
  {
    id: 'n1',
    patientId: 'p1',
    authorName: 'Dr. Berg',
    text: 'Fake note for the demo: patient reports feeling well.',
    visibility: 'standard',
    createdAt: '2026-01-10T09:00:00.000Z',
  },
  {
    id: 'n2',
    patientId: 'p1',
    authorName: 'Nurse Svensson',
    text: 'Fake follow-up note: vitals checked, no concerns.',
    visibility: 'standard',
    createdAt: '2026-01-12T14:30:00.000Z',
  },
  {
    id: 'n3',
    patientId: 'p2',
    authorName: 'Dr. Berg',
    text: 'Fake note for the second demo patient.',
    visibility: 'standard',
    createdAt: '2026-02-01T08:15:00.000Z',
  },
]

export interface MockAccessLogEntry {
  readonly id: string
  readonly patientId: string
  readonly userName: string
  readonly role: Role
  readonly action: 'read' | 'write' | 'denied'
  readonly timestamp: string
}

export const mockAccessLog: readonly MockAccessLogEntry[] = [
  {
    id: 'a1',
    patientId: 'p1',
    userName: 'Dr. Berg',
    role: 'clinician',
    action: 'read',
    timestamp: '2026-01-10T09:00:05.000Z',
  },
  {
    id: 'a2',
    patientId: 'p1',
    userName: 'Nurse Svensson',
    role: 'clinician',
    action: 'read',
    timestamp: '2026-01-12T14:31:00.000Z',
  },
  {
    id: 'a3',
    patientId: 'p2',
    userName: 'Dr. Berg',
    role: 'clinician',
    action: 'read',
    timestamp: '2026-02-01T08:16:00.000Z',
  },
]
