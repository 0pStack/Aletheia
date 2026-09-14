import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  it('renders a single page-level heading naming the product, separate from the form heading', () => {
    render(<LoginPage />)

    expect(screen.getAllByRole('heading', { level: 1, name: /aletheia/i })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: /sign in/i })).toBeInTheDocument()
  })

  it('does not announce the decorative hero wordmark as a second heading', () => {
    render(<LoginPage />)

    expect(screen.getAllByRole('heading', { name: /aletheia/i })).toHaveLength(1)
  })

  it('exposes username and password fields reachable by their labels', () => {
    render(<LoginPage />)

    const username = screen.getByLabelText('Username')
    const password = screen.getByLabelText('Password')

    expect(username).toBeInTheDocument()
    expect(password).toHaveAttribute('type', 'password')
  })

  it('lets the user reveal and hide the password', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: /show password/i }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: /hide password/i }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('warns that Caps Lock is on while typing the password', () => {
    render(<LoginPage />)
    const password = screen.getByLabelText('Password')

    fireEvent.keyUp(password, { key: 'A', modifierCapsLock: true })

    const hint = screen.getByText(/caps lock is on/i)
    expect(password).toHaveAttribute('aria-describedby', hint.id)

    fireEvent.keyUp(password, { key: 'a', modifierCapsLock: false })
    expect(screen.queryByText(/caps lock is on/i)).not.toBeInTheDocument()
  })

  it('has a submit button labelled Sign in', () => {
    render(<LoginPage />)

    expect(screen.getByRole('button', { name: /sign in/i })).toHaveAttribute('type', 'submit')
  })

  it('does not reload the page on submit', async () => {
    const user = userEvent.setup()
    const { container } = render(<LoginPage />)

    const form = container.querySelector('form')
    if (!form) throw new Error('Expected a form element')

    await user.type(screen.getByLabelText('Username'), 'dr.berg')
    await user.type(screen.getByLabelText('Password'), 'hunter2')

    const notPrevented = fireEvent.submit(form)

    expect(notPrevented).toBe(false)
  })
})
