import { QueryClient } from '@tanstack/react-query'

// Kept in memory only: patient data must never be persisted to browser storage.
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false },
    },
  })
}
