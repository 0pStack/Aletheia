import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { request } from '../../api/http'
import { queryKeys } from '../../api/queryKeys'
import type { NoteVisibility } from '../../api/schemas'

export interface NewNote {
  readonly text: string
  readonly visibility: NoteVisibility
}

// The journal is refetched after a write, so the saved note is read back from
// GET /api/patients/:id like every other note rather than trusted from this response.
const ignoredResult = z.unknown()

export function useCreateNote(patientId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (note: NewNote) =>
      request(`/api/patients/${patientId}/notes`, ignoredResult, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.patient(patientId) }),
  })
}
