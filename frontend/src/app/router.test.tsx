import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { describe, expect, it } from 'vitest'
import { server } from '../mocks/server'
import { createQueryClient } from './queryClient'
import { routes } from './router'

function signedIn() {
  return HttpResponse.json({
    success: true,
    data: {
      id: 1,
      username: 'doctor_dr_house',
      name: 'Dr. Gregory House',
      role: 'DOCTOR',
      patientId: null,
    },
    error: null,
  })
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('app routes', () => {
  it('sends a signed-out user from /patients to the sign-in page', async () => {
    renderAt('/patients')

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })

  it('lets a signed-in user reach /patients', async () => {
    server.use(http.get('*/api/auth/session', signedIn))

    renderAt('/patients')

    expect(await screen.findByRole('heading', { name: /patients/i })).toBeInTheDocument()
  })

  it('announces that the session is being checked', async () => {
    server.use(http.get('*/api/auth/session', () => delay('infinite')))

    renderAt('/patients')

    expect(await screen.findByRole('status')).toHaveTextContent(/checking your session/i)
  })

  it('shows an error with a retry instead of redirecting when the server is unreachable', async () => {
    server.use(http.get('*/api/auth/session', () => HttpResponse.error()))

    renderAt('/patients')

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i)
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('alert'))

    server.use(http.get('*/api/auth/session', signedIn))
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByRole('heading', { name: /patients/i })).toBeInTheDocument()
  })

  it('keeps the app navigation on an unknown page for a signed-in user', async () => {
    server.use(http.get('*/api/auth/session', signedIn))

    renderAt('/patients/p1/unknown')

    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /main/i })).toBeInTheDocument()
  })
})
