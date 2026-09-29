import { describe, expect, it, vi } from 'vitest'
import type { AccessEvent } from './chain/access-event.js'
import { signAccessEvent } from './chain/access-event-signing.js'
import { Blockchain } from './chain/blockchain.js'
import { generateKeyPair } from './chain/keypair.js'
import { createChainSyncHandlers } from './peer-sync.js'

const keys = generateKeyPair()
const signedEvent = (id: string): AccessEvent =>
  signAccessEvent(
    {
      id,
      patientId: 4,
      userId: 1,
      role: 'DOCTOR',
      action: 'WRITE',
      timestamp: '2026-09-28T10:00:00.000Z',
      serverId: 'server-3001',
    },
    keys.privateKey,
    keys.publicKey,
  )

describe('pushing accepted blocks on to clients', () => {
  it('passes on a block accepted from a peer', () => {
    const onBlockAccepted = vi.fn()
    const handlers = createChainSyncHandlers(new Blockchain(), onBlockAccepted)
    const block = new Blockchain().addBlock([signedEvent('event-1')])

    handlers.onNewBlock?.(block, () => undefined)

    expect(onBlockAccepted).toHaveBeenCalledExactlyOnceWith(block)
  })

  it('does not pass on a block it already has', () => {
    const onBlockAccepted = vi.fn()
    const handlers = createChainSyncHandlers(new Blockchain(), onBlockAccepted)
    const block = new Blockchain().addBlock([signedEvent('event-1')])

    handlers.onNewBlock?.(block, () => undefined)
    handlers.onNewBlock?.(block, () => undefined)

    expect(onBlockAccepted).toHaveBeenCalledTimes(1)
  })

  it('does not pass on a block it rejects', () => {
    const onBlockAccepted = vi.fn()
    const handlers = createChainSyncHandlers(new Blockchain(), onBlockAccepted)
    const block = new Blockchain().addBlock([signedEvent('event-1')])
    block.hash = 'f'.repeat(64)

    handlers.onNewBlock?.(block, () => undefined)

    expect(onBlockAccepted).not.toHaveBeenCalled()
  })
})
