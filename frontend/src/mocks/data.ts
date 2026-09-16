import type { Role } from '../api/schemas'

// Fake data for the mock API, aligned with the contract agreed in issue #3
// (docs/interfaces.md). Names, personal numbers and notes below are fictional.

export const STAFF_ROLES: readonly Role[] = ['DOCTOR', 'NURSE', 'CLINIC']

export interface MockUser {
  readonly id: number
  readonly username: string
  readonly password: string
  readonly name: string
  readonly role: Role
  readonly patientId: number | null
}

export const mockUsers: readonly MockUser[] = [
  {
    id: 1,
    username: 'dr.berg',
    password: 'hunter2',
    name: 'Dr. Sven Berg',
    role: 'DOCTOR',
    patientId: null,
  },
  {
    id: 2,
    username: 'n.svensson',
    password: 'hunter2',
    name: 'Nurse Elin Svensson',
    role: 'NURSE',
    patientId: null,
  },
  {
    id: 3,
    username: 'clinic.vasa',
    password: 'hunter2',
    name: 'Vasa Clinic Staff',
    role: 'CLINIC',
    patientId: null,
  },
  {
    id: 4,
    username: 'a.lindqvist',
    password: 'hunter2',
    name: 'Astrid Lindqvist',
    role: 'PATIENT',
    patientId: 101,
  },
  {
    id: 5,
    username: 'k.holm',
    password: 'hunter2',
    name: 'K. Holm',
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
  { id: 101, name: 'Astrid Lindqvist', personalNumber: '19000101-0001' },
  { id: 102, name: 'Bo Forsberg', personalNumber: '19000101-0002' },
  { id: 103, name: 'Chana Okafor', personalNumber: '19000101-0003' },
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
    patientId: 101,
    authorId: 1,
    authorName: 'Dr. Sven Berg',
    authorRole: 'DOCTOR',
    text: 'Fake note for the demo: patient reports feeling well.',
    visibility: 'ALL',
    createdAt: '2026-01-10T09:00:00.000Z',
  },
  {
    id: 2,
    patientId: 101,
    authorId: 2,
    authorName: 'Nurse Elin Svensson',
    authorRole: 'NURSE',
    text: 'Fake follow-up note: vitals checked, no concerns.',
    visibility: 'STAFF',
    createdAt: '2026-01-12T14:30:00.000Z',
  },
  {
    id: 3,
    patientId: 101,
    authorId: 1,
    authorName: 'Dr. Sven Berg',
    authorRole: 'DOCTOR',
    text: 'Fake private note: internal reminder to follow up next visit.',
    visibility: 'PRIVATE',
    createdAt: '2026-01-13T08:00:00.000Z',
  },
  {
    id: 4,
    patientId: 102,
    authorId: 1,
    authorName: 'Dr. Sven Berg',
    authorRole: 'DOCTOR',
    text: 'Fake note for the second demo patient.',
    visibility: 'ALL',
    createdAt: '2026-02-01T08:15:00.000Z',
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
    patientId: 101,
    userId: 1,
    userName: 'Dr. Sven Berg',
    role: 'DOCTOR',
    action: 'READ',
    timestamp: '2026-01-10T09:00:05.000Z',
    serverId: 'server-1',
    blockIndex: 1,
  },
  {
    eventId: '22222222-2222-4222-8222-222222222222',
    patientId: 101,
    userId: 2,
    userName: 'Nurse Elin Svensson',
    role: 'NURSE',
    action: 'READ',
    timestamp: '2026-01-12T14:31:00.000Z',
    serverId: 'server-1',
    blockIndex: 2,
  },
  {
    eventId: '33333333-3333-4333-8333-333333333333',
    patientId: 102,
    userId: 1,
    userName: 'Dr. Sven Berg',
    role: 'DOCTOR',
    action: 'READ',
    timestamp: '2026-02-01T08:16:00.000Z',
    serverId: 'server-1',
    blockIndex: 3,
  },
]
