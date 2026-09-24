import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
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
  return router
}

describe('app routes', () => {
  it('sends a signed-out user from /patients to the sign-in page', async () => {
    renderAt('/patients')

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })

  it('lets a signed-in user reach /patients', async () => {
    server.use(http.get('*/api/auth/session', signedIn))

    renderAt('/patients')

    expect(await screen.findByRole('heading', { name: 'Patients' })).toBeInTheDocument()
  })

  it('greets a signed-in user by name on the landing page with a way into their task', async () => {
    server.use(http.get('*/api/auth/session', signedIn))

    renderAt('/')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dr. Gregory House' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: /search patients/i })).toHaveAttribute(
      'href',
      '/#patients',
    )
  })

  it('leads from the main navigation to the team section', async () => {
    server.use(http.get('*/api/auth/session', signedIn))

    renderAt('/')

    const nav = await screen.findByRole('navigation', { name: /main/i })
    expect(within(nav).getByRole('link', { name: 'Team' })).toHaveAttribute('href', '/#team')
    expect(within(nav).queryByRole('link', { name: 'Patients' })).not.toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Team' })).toHaveAttribute('id', 'team')
  })

  it('signs the user out and returns to the sign-in page', async () => {
    server.use(http.get('*/api/auth/session', signedIn))
    const router = renderAt('/patients')
    await screen.findByRole('heading', { name: 'Patients' })

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    // No remembered page: the next person to sign in here must not land on this user's screen.
    expect(router.state.location.state).toBeNull()
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

    expect(await screen.findByRole('heading', { name: 'Patients' })).toBeInTheDocument()
  })

  it('keeps the app navigation on an unknown page for a signed-in user', async () => {
    server.use(http.get('*/api/auth/session', signedIn))

    renderAt('/patients/p1/unknown')

    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /main/i })).toBeInTheDocument()
  })
})
