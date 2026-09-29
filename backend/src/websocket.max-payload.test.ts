import { createServer, type Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { describe, expect, it, vi } from 'vitest'
import { Block } from './chain/block.js'
import { signAccessEvent } from './chain/access-event-signing.js'
import { generateKeyPair } from './chain/keypair.js'
import { MAX_WEB_SOCKET_PAYLOAD_BYTES, attachWebSocketServer } from './websocket.js'

const DEMO_CHAIN_LENGTH = 1000
const WS_MESSAGE_TOO_BIG = 1009

function buildDemoChain(length: number): readonly Block[] {
  const { publicKey, privateKey } = generateKeyPair()

  return Array.from({ length }, (_, index) => {
    const event = signAccessEvent(
      {
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        patientId: index,
        userId: index,
        role: 'DOCTOR',
        action: 'READ',
        timestamp: new Date(0).toISOString(),
        serverId: 'node-a',
      },
      privateKey,
      publicKey,
    )

    return new Block(index, new Date(0).toISOString(), [event], 'f'.repeat(64), index)
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

describe('WebSocket max payload', () => {
  it('fits a CHAIN_RESPONSE for a demo-sized chain', () => {
    const message = JSON.stringify({
      type: 'CHAIN_RESPONSE',
      chain: buildDemoChain(DEMO_CHAIN_LENGTH),
    })

    expect(Buffer.byteLength(message)).toBeLessThan(MAX_WEB_SOCKET_PAYLOAD_BYTES)
  })

  it('rejects and logs an oversize message from a client', async () => {
    const server = createServer()
    const onNewBlock = vi.fn()
    const webSocketServer = attachWebSocketServer(server, [], { onNewBlock })
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const port = await listen(server)

    const socket = new WebSocket(`ws://localhost:${port}`)

    await new Promise<void>((resolve) => {
      socket.once('open', () => resolve())
    })

    const closed = new Promise<number>((resolve) => {
      socket.once('close', (code) => resolve(code))
    })

    socket.send('x'.repeat(MAX_WEB_SOCKET_PAYLOAD_BYTES + 1))

    expect(await closed).toBe(WS_MESSAGE_TOO_BIG)
    await vi.waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Rejected oversize WebSocket message'),
      )
    })
    expect(consoleWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('Invalid WebSocket message'),
    )
    expect(onNewBlock).not.toHaveBeenCalled()

    consoleInfo.mockRestore()
    consoleWarn.mockRestore()
    webSocketServer.close()
    server.close()
  })

  it('rejects and logs an oversize message from a peer', async () => {
    const server = createServer()
    const peerServer = new WebSocketServer({ port: 0 })
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await new Promise<void>((resolve) => {
      peerServer.once('listening', () => resolve())
    })

    const address = peerServer.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine peer server port')
    }

    const closedByUs = new Promise<number>((resolve) => {
      peerServer.once('connection', (peerSocket) => {
        peerSocket.once('close', (code) => resolve(code))
        peerSocket.send('x'.repeat(MAX_WEB_SOCKET_PAYLOAD_BYTES + 1))
      })
    })

    const webSocketServer = attachWebSocketServer(server, [`ws://localhost:${address.port}`])

    expect(await closedByUs).toBe(WS_MESSAGE_TOO_BIG)
    await vi.waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Rejected oversize WebSocket message'),
      )
    })
    expect(consoleWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('Invalid WebSocket message'),
    )

    consoleInfo.mockRestore()
    consoleWarn.mockRestore()
    consoleError.mockRestore()
    webSocketServer.close()
    peerServer.close()
    server.close()
  })
})
