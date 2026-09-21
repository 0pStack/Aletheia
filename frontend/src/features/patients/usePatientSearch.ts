import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { request } from '../../api/http'
import { queryKeys } from '../../api/queryKeys'
import { patientSummarySchema, type PatientSummary } from '../../api/schemas'

const SEARCH_DEBOUNCE_MS = 250
const patientListSchema = z.array(patientSummarySchema)

export type SearchMode = 'idle' | 'search' | 'all'

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

function fetcherFor(
  mode: SearchMode,
  query: string,
): (() => Promise<PatientSummary[]>) | typeof skipToken {
  if (mode === 'search') {
    return () => request(`/api/patients?q=${encodeURIComponent(query)}`, patientListSchema)
  }
  // Leaving q out is the backend's "view all"; a blank q would be refused.
  if (mode === 'all') return () => request('/api/patients', patientListSchema)
  return skipToken
}

// A typed query always wins over "view all", so the list narrows as soon as the user types.
export function usePatientSearch(input: string, showAll: boolean) {
  const trimmed = input.trim()
  const debounced = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS)
  // Only typing waits for the debounce: clearing the box (View all does) takes effect at once,
  // so the old results never flash back for a beat.
  const query = trimmed === '' ? '' : debounced
  const mode: SearchMode = query !== '' ? 'search' : showAll ? 'all' : 'idle'

  const search = useQuery({
    queryKey: mode === 'all' ? queryKeys.patientList : queryKeys.patientSearch(query),
    queryFn: fetcherFor(mode, query),
    // Keeps the last results on screen while the next query loads, so the blocks don't blink.
    placeholderData: keepPreviousData,
    retry: false,
  })

  return { mode, query, search }
}
