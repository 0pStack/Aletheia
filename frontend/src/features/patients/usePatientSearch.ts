import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { request } from '../../api/http'
import { queryKeys } from '../../api/queryKeys'
import { patientSummarySchema } from '../../api/schemas'

const SEARCH_DEBOUNCE_MS = 250
const patientListSchema = z.array(patientSummarySchema)

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

// The backend rejects an empty query, so nothing is fetched until there is something to match.
export function usePatientSearch(input: string) {
  const query = useDebouncedValue(input.trim(), SEARCH_DEBOUNCE_MS)

  const search = useQuery({
    queryKey: queryKeys.patientSearch(query),
    queryFn:
      query === ''
        ? skipToken
        : () => request(`/api/patients?q=${encodeURIComponent(query)}`, patientListSchema),
    // Keeps the last results on screen while the next query loads, so the list doesn't blink.
    placeholderData: keepPreviousData,
    retry: false,
  })

  return { query, search }
}
