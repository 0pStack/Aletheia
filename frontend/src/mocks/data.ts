import { STAFF_ROLES, type Role } from '../api/schemas'

// Fake data for the mock API, aligned with the contract agreed in issue #3
// (docs/interfaces.md). Users, patients and notes mirror backend/db/seed.ts on a
// fresh database, so the same logins and ids work with mocks on or off.

export { STAFF_ROLES }

export interface MockUser {
  readonly id: number
  readonly username: string
  readonly password: string
  readonly name: string
  readonly role: Role
  readonly patientId: number | null
}

const SEED_PASSWORD = 'Password123!'

export const mockUsers: readonly MockUser[] = [
  {
    id: 1,
    username: 'doctor_dr_house',
    password: SEED_PASSWORD,
    name: 'Dr. Gregory House',
    role: 'DOCTOR',
    patientId: null,
  },
  {
    id: 2,
    username: 'nurse_jackie',
    password: SEED_PASSWORD,
    name: 'Jackie Peyton',
    role: 'NURSE',
    patientId: null,
  },
  {
    id: 3,
    username: 'clinic_admin',
    password: SEED_PASSWORD,
    name: 'City Central Clinic',
    role: 'CLINIC',
    patientId: null,
  },
  {
    id: 4,
    username: 'patient_anna',
    password: SEED_PASSWORD,
    name: 'Anna Andersson',
    role: 'PATIENT',
    patientId: 1,
  },
  {
    id: 5,
    username: 'unauth_user',
    password: SEED_PASSWORD,
    name: 'Eve Stranded',
    role: 'UNAUTHORIZED',
    patientId: null,
  },
]

export interface MockPatient {
  readonly id: number
  readonly name: string
  readonly personalNumber: string
}

export const mockPatients: readonly MockPatient[] = [
  { id: 1, name: 'Anna Andersson', personalNumber: '19850101-1234' },
  { id: 2, name: 'Bengt Berg', personalNumber: '19700512-5678' },
  { id: 3, name: 'Cecilia Carlsson', personalNumber: '19921130-9012' },
]

export interface MockNote {
  readonly id: number
  readonly patientId: number
  readonly authorId: number
  readonly authorName: string
  readonly authorRole: Role
  readonly text: string
  readonly visibility: 'PRIVATE' | 'STAFF' | 'ALL'
  readonly createdAt: string
}

export const mockNotes: readonly MockNote[] = [
  {
    id: 1,
    patientId: 1,
    authorId: 1,
    authorName: 'Dr. Gregory House',
    authorRole: 'DOCTOR',
    text: 'Patient presents mild fever and sore throat. Prescribed rest.',
    visibility: 'ALL',
    createdAt: '2026-01-10T09:00:00.000Z',
  },
  {
    id: 2,
    patientId: 1,
    authorId: 2,
    authorName: 'Jackie Peyton',
    authorRole: 'NURSE',
    text: 'Observed elevated heart rate during check-in. Monitor daily.',
    visibility: 'STAFF',
    createdAt: '2026-01-12T14:30:00.000Z',
  },
  {
    id: 3,
    patientId: 1,
    authorId: 1,
    authorName: 'Dr. Gregory House',
    authorRole: 'DOCTOR',
    text: 'Confidential physician observations regarding preliminary differential diagnosis.',
    visibility: 'PRIVATE',
    createdAt: '2026-01-13T08:00:00.000Z',
  },
  {
    id: 4,
    patientId: 2,
    authorId: 1,
    authorName: 'Dr. Gregory House',
    authorRole: 'DOCTOR',
    text: 'Routine annual health examination. All values nominal.',
    visibility: 'ALL',
    createdAt: '2026-02-01T08:15:00.000Z',
  },
  {
    id: 5,
    patientId: 2,
    authorId: 2,
    authorName: 'Jackie Peyton',
    authorRole: 'NURSE',
    text: 'Patient reported mild anxiety during blood sampling.',
    visibility: 'STAFF',
    createdAt: '2026-02-01T08:40:00.000Z',
  },
  {
    id: 6,
    patientId: 3,
    authorId: 3,
    authorName: 'City Central Clinic',
    authorRole: 'CLINIC',
    text: 'Clinic follow-up completed.',
    visibility: 'ALL',
    createdAt: '2026-02-10T10:00:00.000Z',
  },
]

export interface MockAccessLogEntry {
  readonly eventId: string
  readonly patientId: number
  readonly userId: number
  readonly userName: string
  readonly role: Role
  readonly action: 'READ' | 'WRITE' | 'DENIED'
  readonly timestamp: string
  readonly serverId: string
  readonly blockIndex: number
}

export const mockAccessLog: readonly MockAccessLogEntry[] = [
  {
    eventId: '11111111-1111-4111-8111-111111111111',
    patientId: 1,
    userId: 1,
    userName: 'Dr. Gregory House',
    role: 'DOCTOR',
    action: 'READ',
    timestamp: '2026-01-10T09:00:05.000Z',
    serverId: 'server-1',
    blockIndex: 1,
  },
  {
    eventId: '22222222-2222-4222-8222-222222222222',
    patientId: 1,
    userId: 2,
    userName: 'Jackie Peyton',
    role: 'NURSE',
    action: 'READ',
    timestamp: '2026-01-12T14:31:00.000Z',
    serverId: 'server-1',
    blockIndex: 2,
  },
  {
    eventId: '33333333-3333-4333-8333-333333333333',
    patientId: 2,
    userId: 1,
    userName: 'Dr. Gregory House',
    role: 'DOCTOR',
    action: 'READ',
    timestamp: '2026-02-01T08:16:00.000Z',
    serverId: 'server-1',
    blockIndex: 3,
  },
]
