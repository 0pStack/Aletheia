import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { describe, expect, it } from 'vitest'
import { createQueryClient } from '../../app/queryClient'
import { routes } from '../../app/router'
import { server } from '../../mocks/server'
import { setCurrentSessionUserId } from '../../mocks/sessionState'

const DOCTOR_ID = 1
const PATIENT_ANNA_ID = 4

function renderLanding(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('patient search on the landing page', () => {
  it('lists matching patients with a link into their journal', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    renderLanding()

    await userEvent.type(await screen.findByRole('searchbox', { name: /search patients/i }), 'anna')

    const result = await screen.findByRole('link', { name: /anna andersson/i })
    expect(result).toHaveAttribute('href', '/patients/1')
    expect(screen.queryByRole('link', { name: /bengt berg/i })).not.toBeInTheDocument()
  })

  it('finds a patient by personal number', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    renderLanding()

    await userEvent.type(
      await screen.findByRole('searchbox', { name: /search patients/i }),
      '19700512',
    )

    expect(await screen.findByRole('link', { name: /bengt berg/i })).toBeInTheDocument()
  })

  it('says so when nothing matches', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    renderLanding()

    await userEvent.type(await screen.findByRole('searchbox', { name: /search patients/i }), 'zzz')

    expect(await screen.findByText(/no patients match/i)).toBeInTheDocument()
  })

  it('offers a retry when the search fails', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    server.use(
      http.get('*/api/patients', () =>
        HttpResponse.json(
          { success: false, data: null, error: { code: 'INTERNAL', message: 'Search is down' } },
          { status: 500 },
        ),
      ),
    )
    renderLanding()

    await userEvent.type(await screen.findByRole('searchbox', { name: /search patients/i }), 'anna')

    expect(await screen.findByRole('alert')).toHaveTextContent('Search is down')
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('is not offered to a patient', async () => {
    setCurrentSessionUserId(PATIENT_ANNA_ID)
    renderLanding()

    expect(await screen.findByRole('link', { name: /open my record/i })).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('sends the old /patients address to the search section', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    const router = renderLanding('/patients')

    expect(await screen.findByRole('searchbox', { name: /search patients/i })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(router.state.location.hash).toBe('#patients')
  })
})
