import { http, HttpResponse } from 'msw'
import { mockPatients, type MockNote, type MockUser } from '../data'
import { addMockNote, allMockNotes } from '../noteStore'
import { badRequest, notFound, requirePatientViewAccess, requireStaffAccess } from './authGuard'
import { numericParamId } from './params'

// A PATIENT only sees ALL-visibility notes. Staff see STAFF and ALL notes,
// plus PRIVATE notes they authored themselves.
function visibleNotes(patientId: number, viewer: MockUser): readonly MockNote[] {
  const notesForPatient = allMockNotes().filter((note) => note.patientId === patientId)

  if (viewer.role === 'PATIENT') {
    return notesForPatient.filter((note) => note.visibility === 'ALL')
  }

  return notesForPatient.filter(
    (note) => note.visibility !== 'PRIVATE' || note.authorId === viewer.id,
  )
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
