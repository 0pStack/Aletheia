import { z } from 'zod'

export const roleSchema = z.enum(['DOCTOR', 'NURSE', 'CLINIC', 'PATIENT', 'UNAUTHORIZED'])
export type Role = z.infer<typeof roleSchema>

// Roles that may search and open any patient; a PATIENT only ever reaches their own record.
export const STAFF_ROLES: readonly Role[] = ['DOCTOR', 'NURSE', 'CLINIC']

export const sessionUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
  role: roleSchema,
  patientId: z.number().nullable(),
})
export type SessionUser = z.infer<typeof sessionUserSchema>

export const loginResultSchema = z.object({ user: sessionUserSchema })
export type LoginResult = z.infer<typeof loginResultSchema>

export const logoutResultSchema = z.object({ message: z.string() })
export type LogoutResult = z.infer<typeof logoutResultSchema>

export const patientSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  personalNumber: z.string(),
})
export type PatientSummary = z.infer<typeof patientSummarySchema>

export const noteVisibilitySchema = z.enum(['PRIVATE', 'STAFF', 'ALL'])
export type NoteVisibility = z.infer<typeof noteVisibilitySchema>

const noteFields = {
  id: z.number(),
  authorId: z.number(),
  authorName: z.string(),
  authorRole: roleSchema,
  visibility: noteVisibilitySchema,
  createdAt: z.iso.datetime(),
}

// A note the server would not let this viewer read arrives without its text. The union
// makes that unreadable-ness impossible to ignore: there is no text to render.
export const noteSchema = z.discriminatedUnion('redacted', [
  z.object({ ...noteFields, redacted: z.literal(false), text: z.string() }),
  z.object({ ...noteFields, redacted: z.literal(true) }),
])
export type Note = z.infer<typeof noteSchema>
export type ReadableNote = Extract<Note, { redacted: false }>

export const patientDetailSchema = z.object({
  patient: patientSummarySchema,
  notes: z.array(noteSchema),
})
export type PatientDetail = z.infer<typeof patientDetailSchema>

export const accessLogActionSchema = z.enum(['READ', 'WRITE', 'DENIED'])
export type AccessLogAction = z.infer<typeof accessLogActionSchema>

export const accessLogEntrySchema = z.object({
  eventId: z.string(),
  userId: z.number(),
  userName: z.string(),
  role: roleSchema,
  action: accessLogActionSchema,
  timestamp: z.string(),
  serverId: z.string(),
  blockIndex: z.number(),
})
export type AccessLogEntry = z.infer<typeof accessLogEntrySchema>
