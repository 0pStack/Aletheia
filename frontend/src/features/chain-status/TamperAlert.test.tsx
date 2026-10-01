import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { createQueryClient } from '../../app/queryClient'
import { server } from '../../mocks/server'
import { TamperAlert } from './TamperAlert'

const DETECTED = { blockIndex: 3, detectedAt: '2026-10-01T12:00:00.000Z' }

function chainStatus(data: object) {
  server.use(
    http.get('*/api/chain/status', () => HttpResponse.json({ success: true, data, error: null })),
  )
}

function renderAlert() {
  const client = createQueryClient()
  render(
    <QueryClientProvider client={client}>
      <TamperAlert />
    </QueryClientProvider>,
  )
  return client
}

describe('TamperAlert', () => {
  it('shows nothing while the chain has never been tampered with', async () => {
    chainStatus({ valid: true, firstInvalidBlockIndex: null, tamperDetected: null })

    const client = renderAlert()

    await expect.poll(() => client.isFetching()).toBe(0)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('names the tampered block while the chain is still invalid', async () => {
    chainStatus({ valid: false, firstInvalidBlockIndex: 3, tamperDetected: DETECTED })

    renderAlert()

    expect(await screen.findByRole('status')).toHaveTextContent('Tampered at block 3')
    expect(screen.getByRole('status')).not.toHaveTextContent(/repaired/i)
  })

  it('keeps showing the tampering after a peer has repaired the chain', async () => {
    chainStatus({ valid: true, firstInvalidBlockIndex: null, tamperDetected: DETECTED })

    renderAlert()

    expect(await screen.findByRole('status')).toHaveTextContent('Tampered at block 3 · repaired')
  })

  it('stays silent when the status cannot be fetched', async () => {
    server.use(http.get('*/api/chain/status', () => HttpResponse.error()))

    const client = renderAlert()

    await expect.poll(() => client.isFetching()).toBe(0)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
