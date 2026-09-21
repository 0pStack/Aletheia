import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../app/queryClient'
import { server } from '../../mocks/server'
import { LoginPage } from './LoginPage'

interface RenderOptions {
  from?: string
}

function renderLoginPage({ from }: RenderOptions = {}) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <p>Landing page</p> },
      { path: '/patients', element: <p>Patient search</p> },
      { path: '/patients/:patientId', element: <p>Journal</p> },
    ],
    {
      initialEntries: [
        { pathname: '/login', state: from ? { from: { pathname: from } } : undefined },
      ],
    },
  )
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

async function signIn(username: string, password: string) {
  const user = userEvent.setup()
  if (username) await user.type(screen.getByLabelText('Username'), username)
  if (password) await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: /sign in/i }))
}

function allowMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.sessionStorage.clear()
})

describe('LoginPage', () => {
  it('renders a single page-level heading naming the product, separate from the form heading', () => {
    renderLoginPage()

    expect(screen.getAllByRole('heading', { level: 1, name: /aletheia/i })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: /sign in/i })).toBeInTheDocument()
  })

  it('does not announce the decorative hero wordmark as a second heading', () => {
    renderLoginPage()

    expect(screen.getAllByRole('heading', { name: /aletheia/i })).toHaveLength(1)
  })

  it('exposes username and password fields reachable by their labels', () => {
    renderLoginPage()

    const username = screen.getByLabelText('Username')
    const password = screen.getByLabelText('Password')

    expect(username).toBeInTheDocument()
    expect(password).toHaveAttribute('type', 'password')
  })

  it('lets the user reveal and hide the password', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.click(screen.getByRole('button', { name: /show password/i }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: /hide password/i }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('warns that Caps Lock is on while typing the password', () => {
    renderLoginPage()
    const password = screen.getByLabelText('Password')

    fireEvent.keyUp(password, { key: 'A', modifierCapsLock: true })

    const hint = screen.getByText(/caps lock is on/i)
    expect(password).toHaveAttribute('aria-describedby', hint.id)

    fireEvent.keyUp(password, { key: 'a', modifierCapsLock: false })
    expect(screen.queryByText(/caps lock is on/i)).not.toBeInTheDocument()
  })

  it('has a submit button labelled Sign in', () => {
    renderLoginPage()

    expect(screen.getByRole('button', { name: /sign in/i })).toHaveAttribute('type', 'submit')
  })

  it('does not reload the page on submit', async () => {
    const user = userEvent.setup()
    const { container } = renderLoginPage()

    const form = container.querySelector('form')
    if (!form) throw new Error('Expected a form element')

    await user.type(screen.getByLabelText('Username'), 'doctor_dr_house')
    await user.type(screen.getByLabelText('Password'), 'Password123!')

    const notPrevented = fireEvent.submit(form)

    expect(notPrevented).toBe(false)
  })

  it('keeps the alert region mounted and empty so later messages are announced', () => {
    renderLoginPage()

    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
  })

  it('sends the user to the landing page after a successful sign in', async () => {
    renderLoginPage()

    await signIn('doctor_dr_house', 'Password123!')

    expect(await screen.findByText('Landing page')).toBeInTheDocument()
  })

  it('plays the full dive once per browser session, then a brief one', async () => {
    allowMotion()
    const first = renderLoginPage()
    await signIn('doctor_dr_house', 'Password123!')
    expect(await screen.findByText(/signed in/i)).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('data-diving', 'full')
    // Only a dive that reached its end counts as seen; skipping is one way to get there.
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(await screen.findByText('Landing page')).toBeInTheDocument()
    first.unmount()

    renderLoginPage()
    await signIn('doctor_dr_house', 'Password123!')
    expect(await screen.findByText(/signed in/i)).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('data-diving', 'brief')
  })

  it('lets any key press skip the dive', async () => {
    allowMotion()
    renderLoginPage()
    await signIn('doctor_dr_house', 'Password123!')
    expect(await screen.findByText(/signed in/i)).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    // The full dive lasts two seconds; arriving inside findBy's one-second limit proves the skip.
    expect(await screen.findByText('Landing page')).toBeInTheDocument()
  })

  it('lands on the landing scene even when the auth guard bounced them from a journal', async () => {
    renderLoginPage({ from: '/patients/2' })

    await signIn('nurse_jackie', 'Password123!')

    expect(await screen.findByText('Landing page')).toBeInTheDocument()
  })

  it('reports wrong credentials and stays on the form', async () => {
    renderLoginPage()

    await signIn('doctor_dr_house', 'wrong-password')

    expect(await screen.findByText(/wrong username or password/i)).toHaveAttribute('role', 'alert')
    expect(screen.getByRole('heading', { level: 2, name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).not.toHaveAttribute('aria-disabled')
    expect(screen.getByLabelText('Password')).toHaveFocus()
  })

  it('asks for both fields without calling the server', async () => {
    let called = false
    server.use(
      http.post('*/api/auth/login', () => {
        called = true
        return HttpResponse.json({ success: false, data: null, error: null }, { status: 500 })
      }),
    )
    renderLoginPage()

    await signIn('doctor_dr_house', '')

    expect(await screen.findByText(/enter your username and password/i)).toHaveAttribute(
      'role',
      'alert',
    )
    expect(screen.getByLabelText('Password')).toHaveFocus()
    expect(called).toBe(false)
  })

  it('reports an unreachable server', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.error()))
    renderLoginPage()

    await signIn('doctor_dr_house', 'Password123!')

    expect(await screen.findByText(/could not reach the server/i)).toHaveAttribute('role', 'alert')
  })

  it('disables the button while the request is in flight', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.post('*/api/auth/login', async () => {
        await gate
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INVALID_CREDENTIALS', message: 'Wrong username or password.' },
          },
          { status: 401 },
        )
      }),
    )
    renderLoginPage()

    await signIn('doctor_dr_house', 'Password123!')

    const button = screen.getByRole('button', { name: /signing in/i })
    // aria-disabled, not disabled: a natively disabled button would drop keyboard focus to <body>.
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toBeEnabled()
    release()
    expect(await screen.findByText(/wrong username or password/i)).toBeInTheDocument()
  })
})
