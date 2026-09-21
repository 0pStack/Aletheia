import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { describe, expect, it } from 'vitest'
import { createQueryClient } from '../../app/queryClient'
import { routes } from '../../app/router'
import { setCurrentSessionUserId } from '../../mocks/sessionState'

const DOCTOR_ID = 1

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('journal panel over the landing page', () => {
  it('opens over the landing scene instead of replacing it', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    renderApp('/patients/1')

    const panel = await screen.findByRole('dialog', { name: 'Anna Andersson' })
    expect(within(panel).getByText(/mild fever and sore throat/i)).toBeInTheDocument()
    // The landing is still there underneath, but out of reach while the journal is open.
    const hero = screen.getByRole('heading', { level: 1, name: 'Dr. Gregory House', hidden: true })
    expect(hero.closest('[inert]')).not.toBeNull()
  })

  it('keeps the search where it was after closing the journal it opened', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    renderApp('/')

    await userEvent.type(await screen.findByRole('searchbox', { name: /search patients/i }), 'anna')
    await userEvent.click(await screen.findByRole('link', { name: /anna andersson/i }))
    const panel = await screen.findByRole('dialog', { name: 'Anna Andersson' })

    await userEvent.click(within(panel).getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: /search patients/i })).toHaveValue('anna')
    expect(screen.getByRole('link', { name: /anna andersson/i })).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    const router = renderApp('/patients/1')
    await screen.findByRole('dialog', { name: 'Anna Andersson' })

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('moves focus into the journal when it opens', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    renderApp('/patients/1')

    const panel = await screen.findByRole('dialog', { name: 'Anna Andersson' })

    expect(panel).toContainElement(document.activeElement as HTMLElement)
  })
})
