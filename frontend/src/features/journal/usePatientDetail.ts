import { skipToken, useQuery } from '@tanstack/react-query'
import { request } from '../../api/http'
import { queryKeys } from '../../api/queryKeys'
import { patientDetailSchema } from '../../api/schemas'

export function usePatientDetail(patientId: number | null) {
  return useQuery({
    queryKey: queryKeys.patient(patientId),
    queryFn:
      patientId === null
        ? skipToken
        : () => request(`/api/patients/${patientId}`, patientDetailSchema),
    // 403 and 404 are answers, not glitches; the error state offers a manual retry instead.
    retry: false,
  })
}
