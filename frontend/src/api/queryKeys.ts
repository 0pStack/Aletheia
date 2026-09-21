export const queryKeys = {
  session: ['session'],
  patient: (id: number | null) => ['patients', id] as const,
  patientSearch: (query: string) => ['patients', 'search', query] as const,
  patientList: ['patients', 'list'] as const,
} as const
