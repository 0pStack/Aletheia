import { useQuery } from '@tanstack/react-query'
import { request } from '../../api/http'
import { queryKeys } from '../../api/queryKeys'
import { sessionUserSchema } from '../../api/schemas'

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: () => request('/api/auth/session', sessionUserSchema),
    retry: false,
  })
}
