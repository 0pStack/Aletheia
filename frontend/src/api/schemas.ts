import { z } from 'zod'

// Placeholder until the backend track agrees the session shape (issues #3, #11, #23).
export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
})

export type SessionUser = z.infer<typeof sessionUserSchema>

// Placeholder shapes for the mock API (issue #6) until #3 agrees the real ones.
export const patientSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type PatientSummary = z.infer<typeof patientSummarySchema>

export const noteSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  authorName: z.string(),
  text: z.string(),
  visibility: z.string(),
  createdAt: z.string(),
})

export type Note = z.infer<typeof noteSchema>

export const patientDetailSchema = z.object({
  patient: patientSummarySchema,
  notes: z.array(noteSchema),
})

export type PatientDetail = z.infer<typeof patientDetailSchema>

export const accessLogEntrySchema = z.object({
  id: z.string(),
  patientId: z.string(),
  userName: z.string(),
  role: z.string(),
  action: z.string(),
  timestamp: z.string(),
})

export type AccessLogEntry = z.infer<typeof accessLogEntrySchema>
