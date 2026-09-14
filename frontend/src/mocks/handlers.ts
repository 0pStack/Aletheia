import { http, HttpResponse } from 'msw'

// The session endpoint path is not agreed with the backend track yet (issue #11).
export const handlers = [
  http.get('*/api/auth/session', () =>
    HttpResponse.json({ success: false, data: null, error: 'Not signed in' }, { status: 401 }),
  ),
]
