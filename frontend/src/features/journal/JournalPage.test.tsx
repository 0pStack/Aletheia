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

describe('JournalPage', () => {
  it('shows the patient and their notes', async () => {
    setCurrentSessionUserId(DOCTOR_ID)

    renderJournal('/patients/1')

    expect(await screen.findByRole('heading', { name: 'Anna Andersson' })).toBeInTheDocument()
    expect(screen.getByText('19850101-1234')).toBeInTheDocument()
    expect(screen.getByText(/mild fever and sore throat/i)).toBeInTheDocument()
    expect(screen.getAllByText('Dr. Gregory House').length).toBeGreaterThan(0)
  })

  it('shows staff the visibility of every note the server sent', async () => {
    setCurrentSessionUserId(DOCTOR_ID)

    renderJournal('/patients/1')

    expect(await screen.findByRole('heading', { name: 'Anna Andersson' })).toBeInTheDocument()
    expect(screen.getByText(/private notes you wrote yourself/i)).toBeInTheDocument()
    expect(screen.getByText('Staff only')).toBeInTheDocument()
    expect(screen.getByText('Private')).toBeInTheDocument()
  })

  it('shows a patient only what the server shared, without visibility labels', async () => {
    setCurrentSessionUserId(PATIENT_ANNA_ID)

    renderJournal('/patients/1')

    // The landing behind the panel greets Anna by name too, so wait on the note itself.
    expect(await screen.findByText(/mild fever and sore throat/i)).toBeInTheDocument()
    expect(screen.getByText(/your journal/i)).toBeInTheDocument()
    expect(screen.getByText(/shared with you/i)).toBeInTheDocument()
    // The server never sends these, so the browser has nothing to hide.
    expect(screen.queryByText(/elevated heart rate/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/differential diagnosis/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Staff only')).not.toBeInTheDocument()
    expect(screen.queryByText('Visible to patient')).not.toBeInTheDocument()
  })

  it('says so when the patient has no notes', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    server.use(
      http.get('*/api/patients/:id', () =>
        HttpResponse.json({
          success: true,
          data: {
            patient: { id: 2, name: 'Bengt Berg', personalNumber: '19700512-5678' },
            notes: [],
          },
          error: null,
        }),
      ),
    )

    renderJournal('/patients/2')

    expect(await screen.findByText(/no notes yet/i)).toBeInTheDocument()
  })

  it('tells the user when the patient does not exist', async () => {
    setCurrentSessionUserId(DOCTOR_ID)

    renderJournal('/patients/999')

    expect(await screen.findByRole('heading', { name: /patient not found/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to patients/i })).toBeInTheDocument()
  })

  it.each(['abc', '1e2', '0x10', '0'])(
    'treats the malformed id %s as a missing patient',
    async (rawId) => {
      setCurrentSessionUserId(DOCTOR_ID)

      renderJournal(`/patients/${rawId}`)

      expect(await screen.findByRole('heading', { name: /patient not found/i })).toBeInTheDocument()
    },
  )

  it('sends a patient opening someone else’s record to the access denied page', async () => {
    setCurrentSessionUserId(PATIENT_ANNA_ID)

    renderJournal('/patients/2')

    expect(await screen.findByRole('heading', { name: /access denied/i })).toBeInTheDocument()
  })

  it('offers a retry when the journal fails to load', async () => {
    setCurrentSessionUserId(DOCTOR_ID)
    server.use(
      http.get('*/api/patients/:id', () =>
        HttpResponse.json(
          { success: false, data: null, error: { code: 'INTERNAL', message: 'Database offline' } },
          { status: 500 },
        ),
      ),
    )

    renderJournal('/patients/1')

    expect(await screen.findByRole('alert')).toHaveTextContent('Database offline')
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
