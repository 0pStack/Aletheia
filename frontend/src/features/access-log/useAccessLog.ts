import { skipToken, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { request } from '../../api/http'
import { queryKeys } from '../../api/queryKeys'
import { accessLogEntrySchema } from '../../api/schemas'

const accessLogSchema = z.array(accessLogEntrySchema)

export function useAccessLog(patientId: number | null) {
  return useQuery({
    queryKey: queryKeys.accessLog(patientId),
    queryFn:
      patientId === null
        ? skipToken
        : () => request(`/api/patients/${patientId}/access-log`, accessLogSchema),
    retry: false,
  })
}
