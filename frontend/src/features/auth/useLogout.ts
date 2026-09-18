import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { request } from '../../api/http'
import { logoutResultSchema } from '../../api/schemas'

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => request('/api/auth/logout', logoutResultSchema, { method: 'POST' }),
    // Runs on failure too: on a shared ward computer the screen must never keep showing
    // records because the sign-out request itself went wrong.
    // Leave first, clear second. Clearing while the auth guard is still mounted makes it refetch
    // the session, get a 401 and redirect with the current page remembered as the place to
    // return to, which would send the next person to sign in straight to this user's page.
    onSettled: async () => {
      await navigate('/login', { replace: true })
      queryClient.clear()
    },
  })
}
