export const queryKeys = {
  session: ['session'],
  patient: (id: number | null) => ['patients', id] as const,
} as const
