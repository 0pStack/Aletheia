import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
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

function renderJournal(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('AccessLog', () => {
  it('shows who has opened the record, alongside the journal', async () => {
    setCurrentSessionUserId(DOCTOR_ID)

    renderJournal('/patients/1')

    expect(await screen.findByRole('heading', { name: /who has opened/i })).toBeInTheDocument()
    const log = await screen.findByRole('table', { name: /access log/i })
    expect(log).toHaveTextContent('Dr. Gregory House')
    expect(log).toHaveTextContent('Jackie Peyton')
    expect(log).toHaveTextContent('Opened the record')
  })

  it('lets a patient see who has opened their own record', async () => {
    setCurrentSessionUserId(PATIENT_ANNA_ID)

    renderJournal('/patients/1')

    expect(await screen.findByRole('heading', { name: /who has opened/i })).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: /access log/i })).toHaveTextContent(
      'Dr. Gregory House',
    )
  })

  it('says so when nobody has opened the record yet', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    server.use(
      http.get('*/api/patients/:id/access-log', () =>
        HttpResponse.json({ success: true, data: [], error: null }),
      ),
    )

    renderJournal('/patients/1')

    expect(await screen.findByText(/no one has opened this record yet/i)).toBeInTheDocument()
  })

  it('offers a retry when the log fails to load, without hiding the journal', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    server.use(
      http.get('*/api/patients/:id/access-log', () =>
        HttpResponse.json(
          { success: false, data: null, error: { code: 'INTERNAL', message: 'Chain unreachable' } },
          { status: 500 },
        ),
      ),
    )

    renderJournal('/patients/1')

    expect(await screen.findByText('Chain unreachable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    // The journal itself is unaffected by the log failing.
    expect(screen.getByText(/mild fever and sore throat/i)).toBeInTheDocument()
  })

  it('names the action in words rather than the chain’s vocabulary', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    server.use(
      http.get('*/api/patients/:id/access-log', () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              eventId: 'a',
              userId: 1,
              userName: 'Dr. Gregory House',
              role: 'DOCTOR',
              action: 'WRITE',
              timestamp: '2026-01-10T09:00:00.000Z',
              serverId: 'server-2',
              blockIndex: 4,
            },
            {
              eventId: 'b',
              userId: 5,
              userName: 'Eve Stranded',
              role: 'UNAUTHORIZED',
              action: 'DENIED',
              timestamp: '2026-01-10T09:05:00.000Z',
              serverId: 'server-1',
              blockIndex: 5,
            },
          ],
          error: null,
        }),
      ),
    )

    renderJournal('/patients/1')

    const log = await screen.findByRole('table', { name: /access log/i })
    expect(log).toHaveTextContent('Wrote a note')
    expect(log).toHaveTextContent('Was refused')
    expect(log).toHaveTextContent('server-2')
    expect(log).toHaveTextContent('#4')
  })
})
