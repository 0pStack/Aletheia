import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../../api/http'
import { queryKeys } from '../../api/queryKeys'
import { loginResultSchema } from '../../api/schemas'

export interface Credentials {
  readonly username: string
  readonly password: string
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (credentials: Credentials) =>
      request('/api/auth/login', loginResultSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      }),
    // Seeds the session query so the auth guard lets the user through without a second round trip.
    onSuccess: ({ user }) => {
      queryClient.setQueryData(queryKeys.session, user)
    },
  })
}
