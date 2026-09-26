import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../app/queryClient'
import { server } from '../../mocks/server'
import { setCurrentSessionUserId } from '../../mocks/sessionState'
import { VerificationBadge } from './VerificationBadge'

const DOCTOR_ID = 1
const EVENT_ID = '11111111-1111-4111-8111-111111111111'

function renderBadge() {
  setCurrentSessionUserId(DOCTOR_ID)
  render(
    <QueryClientProvider client={createQueryClient()}>
      <VerificationBadge eventId={EVENT_ID} />
    </QueryClientProvider>,
  )
}

function proofResponse(isValid: boolean) {
  return HttpResponse.json({
    success: true,
    data: {
      eventId: EVENT_ID,
      blockIndex: 1,
      blockHash: 'a'.repeat(64),
      merkleRoot: 'b'.repeat(64),
      proof: [{ hash: 'c'.repeat(64), position: 'right' }],
      isValid,
    },
    error: null,
  })
}

function errorResponse(status: number, code: string) {
  return HttpResponse.json(
    { success: false, data: null, error: { code, message: 'Nope' } },
    { status },
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('VerificationBadge', () => {
  it('says Checking while the proof is on its way', () => {
    renderBadge()

    expect(screen.getByText('Checking')).toBeInTheDocument()
  })

  it('says Verified when the proof rebuilds the block’s Merkle root', async () => {
    server.use(http.get('*/api/verify/:eventId', () => proofResponse(true)))

    renderBadge()

    expect(await screen.findByText('Verified')).toBeInTheDocument()
  })

  it('says Failed when the server reports the proof does not hold', async () => {
    server.use(http.get('*/api/verify/:eventId', () => proofResponse(false)))

    renderBadge()

    expect(await screen.findByText('Failed')).toBeInTheDocument()
  })

  it('says Failed when the event is no longer on the chain', async () => {
    server.use(http.get('*/api/verify/:eventId', () => errorResponse(404, 'NOT_FOUND')))

    renderBadge()

    expect(await screen.findByText('Failed')).toBeInTheDocument()
  })

  it('says Pending while the event waits to be sealed into a block', async () => {
    server.use(http.get('*/api/verify/:eventId', () => errorResponse(409, 'PENDING')))

    renderBadge()

    expect(await screen.findByText('Pending')).toBeInTheDocument()
  })

  it('does not call an unanswered check Failed', async () => {
    server.use(http.get('*/api/verify/:eventId', () => errorResponse(429, 'RATE_LIMITED')))

    renderBadge()

    expect(await screen.findByText('Not checked')).toBeInTheDocument()
    expect(screen.queryByText('Failed')).not.toBeInTheDocument()
  })

  it('checks again when a Not checked badge is pressed', async () => {
    let answer = errorResponse(500, 'INTERNAL')
    server.use(http.get('*/api/verify/:eventId', () => answer))

    renderBadge()
    const badge = await screen.findByRole('button', { name: /not checked\. check again/i })
    answer = proofResponse(true)
    await userEvent.click(badge)

    expect(await screen.findByText('Verified')).toBeInTheDocument()
  })

  it('asks again on its own once a pending event is sealed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let answer = errorResponse(409, 'PENDING')
    server.use(http.get('*/api/verify/:eventId', () => answer))

    renderBadge()
    expect(await screen.findByText('Pending')).toBeInTheDocument()
    answer = proofResponse(true)
    await vi.advanceTimersByTimeAsync(5000)

    expect(await screen.findByText('Verified')).toBeInTheDocument()
  })
})
