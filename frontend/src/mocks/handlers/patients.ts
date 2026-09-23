import { http, HttpResponse } from 'msw'
import type { Note } from '../../api/schemas'
import { mockPatients, STAFF_ROLES, type MockNote, type MockUser } from '../data'
import { addMockNote, allMockNotes } from '../noteStore'
import { badRequest, notFound, requirePatientViewAccess, requireStaffAccess } from './authGuard'
import { numericParamId } from './params'

// A PATIENT only sees ALL-visibility notes. Staff see STAFF and ALL notes, plus PRIVATE
// notes they authored. A colleague's PRIVATE note reaches staff as a stub with no text,
// so a gap in the list is never silent; a patient gets no stub (issue #83).
function canRead(note: MockNote, viewer: MockUser): boolean {
  if (note.visibility === 'ALL') return true
  if (note.visibility === 'STAFF') return STAFF_ROLES.includes(viewer.role)
  return note.authorId === viewer.id
}

function visibleNotes(patientId: number, viewer: MockUser): readonly Note[] {
  return allMockNotes()
    .filter((note) => note.patientId === patientId)
    .flatMap((note): Note[] => {
      const base = {
        id: note.id,
        authorId: note.authorId,
        authorName: note.authorName,
        authorRole: note.authorRole,
        visibility: note.visibility,
        createdAt: note.createdAt,
      }

      if (canRead(note, viewer)) return [{ ...base, redacted: false, text: note.text }]
      if (STAFF_ROLES.includes(viewer.role) && note.visibility === 'PRIVATE') {
        return [{ ...base, redacted: true }]
      }
      return []
    })
}

export const patientHandlers = [
  http.get('*/api/patients', ({ request }) => {
    const guard = requireStaffAccess()
    if (!guard.ok) return guard.response

    const rawQuery = new URL(request.url).searchParams.get('q')
    // Matches the backend: leaving q out lists everyone, a blank q is refused.
    if (rawQuery === null) {
      const everyone = [...mockPatients].sort((a, b) => a.name.localeCompare(b.name))
      return HttpResponse.json({ success: true, data: everyone, error: null })
    }
    const query = rawQuery.trim().toLowerCase()
    if (query === '') return badRequest('A search query is required.')

    const digits = query.replace(/\D/g, '')
    const results = mockPatients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(query) ||
        (digits !== '' && patient.personalNumber.replace(/-/g, '').includes(digits)),
    )

    return HttpResponse.json({ success: true, data: results, error: null })
  }),

  http.get('*/api/patients/:id', ({ params }) => {
    const patientId = numericParamId(params.id)
    const guard = requirePatientViewAccess(patientId)
    if (!guard.ok) return guard.response

    const patient = mockPatients.find((candidate) => candidate.id === patientId)
    if (!patient) return notFound()

    const notes = visibleNotes(patientId, guard.user)
    return HttpResponse.json({ success: true, data: { patient, notes }, error: null })
  }),
  http.post('*/api/patients/:id/notes', async ({ params, request }) => {
    const patientId = numericParamId(params.id)
    // Writing is staff-only, so a PATIENT is refused here even on their own record.
    const guard = requireStaffAccess()
    if (!guard.ok) return guard.response

    const patient = mockPatients.find((candidate) => candidate.id === patientId)
    if (!patient) return notFound()

    const body: unknown = await request.json().catch(() => null)
    const { text, visibility } = (body ?? {}) as { text?: unknown; visibility?: unknown }

    if (
      typeof text !== 'string' ||
      text.trim() === '' ||
      (visibility !== 'PRIVATE' && visibility !== 'STAFF' && visibility !== 'ALL')
    ) {
      return badRequest('Valid text and visibility are required.')
    }

    const note = addMockNote({
      patientId,
      authorId: guard.user.id,
      authorName: guard.user.name,
      authorRole: guard.user.role,
      text: text.trim(),
      visibility,
      createdAt: new Date().toISOString(),
    })

    // patientId is the route, not part of the note shape in docs/interfaces.md.
    return HttpResponse.json({
      success: true,
      data: {
        redacted: false,
        id: note.id,
        authorId: note.authorId,
        authorName: note.authorName,
        authorRole: note.authorRole,
        text: note.text,
        visibility: note.visibility,
        createdAt: note.createdAt,
      },
      error: null,
    })
  }),
]
