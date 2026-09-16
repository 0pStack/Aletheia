import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { mockUsers, type MockUser } from '../data'
import { getCurrentSessionUser, setCurrentSessionUserId } from '../sessionState'

const loginBodySchema = z.object({
  username: z.string(),
  password: z.string(),
})

function toSessionUser(user: MockUser) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    patientId: user.patientId,
  }
}

function errorEnvelope(code: string, message: string) {
  return { success: false as const, data: null, error: { code, message } }
}

async function readLoginBody(request: Request) {
  const raw: unknown = await request.json().catch(() => null)
  return loginBodySchema.safeParse(raw)
}

export const authHandlers = [
  http.post('*/api/auth/login', async ({ request }) => {
    const body = await readLoginBody(request)
    if (!body.success) {
      return HttpResponse.json(errorEnvelope('BAD_REQUEST', 'Malformed login request'), {
        status: 400,
      })
    }

    const { username, password } = body.data
    const user = mockUsers.find(
      (candidate) => candidate.username === username && candidate.password === password,
    )
    if (!user) {
      return HttpResponse.json(
        errorEnvelope('INVALID_CREDENTIALS', 'Invalid username or password'),
        { status: 401 },
      )
    }

    setCurrentSessionUserId(user.id)
    return HttpResponse.json({ success: true, data: { user: toSessionUser(user) }, error: null })
  }),

  http.post('*/api/auth/logout', () => {
    setCurrentSessionUserId(null)
    return HttpResponse.json({
      success: true,
      data: { message: 'Logged out successfully' },
      error: null,
    })
  }),

  http.get('*/api/auth/session', () => {
    const user = getCurrentSessionUser()
    if (!user) {
      return HttpResponse.json(errorEnvelope('UNAUTHENTICATED', 'Not signed in'), { status: 401 })
    }
    return HttpResponse.json({ success: true, data: toSessionUser(user), error: null })
  }),
]
