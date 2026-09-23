import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { describe, expect, it, vi } from 'vitest'
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

describe('NoteForm', () => {
  it('saves a note and shows it in the journal', async () => {
    const user = userEvent.setup()
    setCurrentSessionUserId(DOCTOR_ID)

    renderJournal('/patients/1')

    await user.type(
      await screen.findByRole('textbox', { name: /new note/i }),
      'Follow-up in two weeks.',
    )
    await user.click(screen.getByRole('radio', { name: /visible to the patient/i }))
    await user.click(screen.getByRole('button', { name: /save note/i }))

    expect(await screen.findByText('Follow-up in two weeks.')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i)
    // The form is ready for the next note rather than holding the last one.
    expect(screen.getByRole('textbox', { name: /new note/i })).toHaveValue('')
  })

  it('sends the visibility the author picked', async () => {
    const user = userEvent.setup()
    setCurrentSessionUserId(DOCTOR_ID)
    const body = vi.fn()
    server.use(
      http.post('*/api/patients/:id/notes', async ({ request }) => {
        body(await request.json())
        return HttpResponse.json({ success: true, data: null, error: null }, { status: 200 })
      }),
    )

    renderJournal('/patients/1')

    await user.type(await screen.findByRole('textbox', { name: /new note/i }), 'Private thought.')
    await user.click(screen.getByRole('radio', { name: /only you/i }))
    await user.click(screen.getByRole('button', { name: /save note/i }))

    await waitFor(() =>
      expect(body).toHaveBeenCalledWith({ text: 'Private thought.', visibility: 'PRIVATE' }),
    )
  })

  it('refuses an empty note without calling the server', async () => {
    const user = userEvent.setup()
    setCurrentSessionUserId(DOCTOR_ID)
    const posted = vi.fn()
    server.use(
      http.post('*/api/patients/:id/notes', () => {
        posted()
        return HttpResponse.json({ success: true, data: null, error: null })
      }),
    )

    renderJournal('/patients/1')

    await user.click(await screen.findByRole('button', { name: /save note/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/write something/i)
    expect(posted).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: /new note/i })).toHaveFocus()
  })

  it('treats whitespace as empty', async () => {
    const user = userEvent.setup()
    setCurrentSessionUserId(DOCTOR_ID)

    renderJournal('/patients/1')

    await user.type(await screen.findByRole('textbox', { name: /new note/i }), '   ')
    await user.click(screen.getByRole('button', { name: /save note/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/write something/i)
  })

  it('drops the empty-note complaint as soon as the author types', async () => {
    const user = userEvent.setup()
    setCurrentSessionUserId(DOCTOR_ID)

    renderJournal('/patients/1')

    await user.click(await screen.findByRole('button', { name: /save note/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/write something/i)

    await user.type(screen.getByRole('textbox', { name: /new note/i }), 'Now there is text.')

    expect(screen.getByRole('alert')).toHaveTextContent('')
  })

  it('keeps the text and explains when the server refuses', async () => {
    const user = userEvent.setup()
    setCurrentSessionUserId(DOCTOR_ID)
    server.use(
      http.post('*/api/patients/:id/notes', () =>
        HttpResponse.json(
          { success: false, data: null, error: { code: 'INTERNAL', message: 'Database offline' } },
          { status: 500 },
        ),
      ),
    )

    renderJournal('/patients/1')

    await user.type(await screen.findByRole('textbox', { name: /new note/i }), 'Keep me.')
    await user.click(screen.getByRole('button', { name: /save note/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Database offline')
    expect(screen.getByRole('textbox', { name: /new note/i })).toHaveValue('Keep me.')
  })

  it('is not offered to a patient reading their own record', async () => {
    setCurrentSessionUserId(PATIENT_ANNA_ID)

    renderJournal('/patients/1')

    expect(await screen.findByText(/mild fever and sore throat/i)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /new note/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save note/i })).not.toBeInTheDocument()
  })
})
