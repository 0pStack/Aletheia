import { createServer, type Server } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import type { AccessEvent } from './chain/access-event.js'
import { signAccessEvent } from './chain/access-event-signing.js'
import { Block } from './chain/block.js'
import { MAX_INCOMING_CHAIN_BLOCKS, MAX_INCOMING_CHAIN_EVENTS } from './chain/chain-validation.js'
import { generateKeyPair } from './chain/keypair.js'
import { MAX_WEB_SOCKET_PAYLOAD_BYTES, attachWebSocketServer } from './websocket.js'

const OLD_PAYLOAD_LIMIT_BYTES = 5 * 1024 * 1024

function buildChainAtCaps(): Block[] {
  const { publicKey, privateKey } = generateKeyPair()
  const eventsPerBlock = MAX_INCOMING_CHAIN_EVENTS / MAX_INCOMING_CHAIN_BLOCKS
  let eventNumber = 0

  const largestRealisticEvent = (): AccessEvent =>
    signAccessEvent(
      {
        id: `00000000-0000-4000-8000-${String(eventNumber++).padStart(12, '0')}`,
        patientId: 999_999,
        userId: 999_999,
        role: 'UNAUTHORIZED',
        action: 'DENIED',
        timestamp: new Date().toISOString(),
        serverId: 'server-3001',
      },
      privateKey,
      publicKey,
    )

  return Array.from({ length: MAX_INCOMING_CHAIN_BLOCKS }, (_, index) => {
    const events = Array.from({ length: eventsPerBlock }, () => largestRealisticEvent())
    return new Block(index, new Date().toISOString(), events, 'f'.repeat(64), index)
  })
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve())
  })

  const address = server.address()

  if (!address || typeof address === 'string') {
    throw new Error('Could not determine server port')
  }

  return address.port
}

const chainAtCaps = buildChainAtCaps()
const chainResponseBytes = Buffer.byteLength(
  JSON.stringify({ type: 'CHAIN_RESPONSE', chain: chainAtCaps }),
)

describe('a chain at the incoming size caps', () => {
  it('is larger than the old 5 MiB payload limit', () => {
    expect(chainResponseBytes).toBeGreaterThan(OLD_PAYLOAD_LIMIT_BYTES)
  })

  it('fits in a single CHAIN_RESPONSE', () => {
    expect(chainResponseBytes).toBeLessThan(MAX_WEB_SOCKET_PAYLOAD_BYTES)
  })

  it('syncs from one node to another', async () => {
    const serverA = createServer()
    const serverB = createServer()
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const nodeA = attachWebSocketServer(serverA, [], { getChain: () => chainAtCaps })
    const portA = await listen(serverA)
    let receivedBlocks: number | undefined

    const nodeB = attachWebSocketServer(serverB, [`ws://localhost:${portA}`], {
      onChain: (chain) => {
        receivedBlocks = chain.length
      },
    })

    await vi.waitFor(
      () => {
        expect(receivedBlocks).toBe(MAX_INCOMING_CHAIN_BLOCKS)
      },
      { timeout: 15_000 },
    )

    consoleInfo.mockRestore()
    nodeB.close()
    nodeA.close()
    serverA.close()
  }, 20_000)
})
