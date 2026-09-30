import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { WebSocket, WebSocketServer } from 'ws'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Blockchain } from './chain/blockchain.js'
import { generateKeyPair } from './chain/keypair.js'
import { createPeerChallenge } from './peer-auth.js'
import {
  authenticateAsPeer,
  authResponse,
  requestChallenge,
  testPeerIdentity,
} from './test-support/peer-handshake.js'
import {
  attachWebSocketServer,
  MAX_UNAUTHENTICATED_MESSAGE_LENGTH,
  type BroadcastWebSocketServer,
} from './websocket.js'

const WS_POLICY_VIOLATION = 1008

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

async function connect(port: number): Promise<WebSocket> {
  const socket = new WebSocket(`ws://localhost:${port}`)
  await new Promise<void>((resolve) => {
    socket.once('open', () => resolve())
  })
  return socket
}

function nextMessage(socket: WebSocket): Promise<{ type: string; [key: string]: unknown }> {
  return new Promise((resolve) => {
    socket.once('message', (data) => resolve(JSON.parse(data.toString())))
  })
}

function closeCode(socket: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    socket.once('close', (code) => resolve(code))
  })
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 50))

describe('inbound peer authentication', () => {
  const servers: Server[] = []
  const webSocketServers: BroadcastWebSocketServer[] = []
  const sockets: WebSocket[] = []
  let consoleWarn: ReturnType<typeof vi.spyOn>

  const startNode = async (
    handlers: Parameters<typeof attachWebSocketServer>[2] = {},
    peers: string[] = [],
  ): Promise<number> => {
    const server = createServer()
    servers.push(server)
    webSocketServers.push(attachWebSocketServer(server, peers, handlers, testPeerIdentity))
    return listen(server)
  }

  const client = async (port: number): Promise<WebSocket> => {
    const socket = await connect(port)
    sockets.push(socket)
    return socket
  }

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.terminate()
    for (const webSocketServer of webSocketServers.splice(0)) webSocketServer.close()
    for (const server of servers.splice(0)) server.close()
    vi.restoreAllMocks()
  })

  it('ignores and logs a CHAIN_REQUEST from a client that has not authenticated', async () => {
    const port = await startNode({ getChain: () => new Blockchain().chain })
    const socket = await client(port)
    const replies: string[] = []
    socket.on('message', (data) => replies.push(data.toString()))

    socket.send(JSON.stringify({ type: 'CHAIN_REQUEST' }))

    await vi.waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith(
        'Ignored CHAIN_REQUEST from an unauthenticated client',
      )
    })
    await settle()
    expect(replies).toEqual([])
  })

  it('does not pass a NEW_BLOCK from an unauthenticated client to the handler', async () => {
    const onNewBlock = vi.fn()
    const port = await startNode({ onNewBlock })
    const socket = await client(port)
    const forged = new Blockchain()
    forged.addBlock([])

    socket.send(JSON.stringify({ type: 'NEW_BLOCK', block: forged.getLatestBlock() }))

    await vi.waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith('Ignored NEW_BLOCK from an unauthenticated client')
    })
    expect(onNewBlock).not.toHaveBeenCalled()
  })

  it('serves the chain and accepts blocks once a trusted node has authenticated', async () => {
    const chain = new Blockchain().chain
    const onNewBlock = vi.fn()
    const port = await startNode({ getChain: () => chain, onNewBlock })
    const socket = await client(port)
    const next = new Blockchain()
    next.addBlock([])

    await authenticateAsPeer(socket)
    const reply = nextMessage(socket)
    socket.send(JSON.stringify({ type: 'CHAIN_REQUEST' }))
    socket.send(JSON.stringify({ type: 'NEW_BLOCK', block: next.getLatestBlock() }))

    expect((await reply).type).toBe('CHAIN_RESPONSE')
    await vi.waitFor(() => {
      expect(onNewBlock).toHaveBeenCalledOnce()
    })
  })

  it('refuses, logs and disconnects a node whose key is not trusted', async () => {
    const port = await startNode()
    const socket = await client(port)
    const closed = closeCode(socket)

    await authenticateAsPeer(socket, generateKeyPair())

    expect(await closed).toBe(WS_POLICY_VIOLATION)
    expect(consoleWarn).toHaveBeenCalledWith(
      'Refused a peer handshake that did not verify against a trusted key',
    )
  })

  it('refuses an AUTH_RESPONSE that answers no challenge', async () => {
    const port = await startNode()
    const socket = await client(port)
    const closed = closeCode(socket)

    socket.send(authResponse(`${'A'.repeat(43)}=`))

    expect(await closed).toBe(WS_POLICY_VIOLATION)
  })

  it('refuses a response replayed from an earlier handshake', async () => {
    const port = await startNode()
    const first = await client(port)
    const recorded = authResponse(await requestChallenge(first))
    first.send(recorded)
    await settle()

    const replay = await client(port)
    const closed = closeCode(replay)
    await requestChallenge(replay)
    replay.send(recorded)

    expect(await closed).toBe(WS_POLICY_VIOLATION)
  })

  it('still broadcasts new blocks to a client that never authenticates', async () => {
    const port = await startNode()
    const socket = await client(port)
    const received = nextMessage(socket)

    webSocketServers[0]?.broadcast({ type: 'NEW_BLOCK', block: { index: 1 } })

    expect((await received).type).toBe('NEW_BLOCK')
  })

  it('drops a large message from an unauthenticated client before parsing it', async () => {
    const onChain = vi.fn()
    const port = await startNode({ onChain })
    const socket = await client(port)
    const parse = vi.spyOn(JSON, 'parse')

    socket.send(
      JSON.stringify({
        type: 'CHAIN_RESPONSE',
        chain: [],
        padding: 'x'.repeat(MAX_UNAUTHENTICATED_MESSAGE_LENGTH),
      }),
    )

    await vi.waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith(
        'Ignored an oversized message from an unauthenticated client',
      )
    })
    expect(parse).not.toHaveBeenCalled()
    expect(onChain).not.toHaveBeenCalled()
  })

  it('hands out one challenge per socket', async () => {
    const port = await startNode()
    const socket = await client(port)
    const challenges: string[] = []
    socket.on('message', (data) => challenges.push(data.toString()))

    for (let request = 0; request < 5; request += 1) {
      socket.send(JSON.stringify({ type: 'AUTH_REQUEST' }))
    }

    await vi.waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledTimes(4)
    })
    expect(consoleWarn).toHaveBeenCalledWith('Ignored a repeated AUTH_REQUEST')
    await settle()
    expect(challenges).toHaveLength(1)
  })

  it('answers only the one challenge it asked for', async () => {
    const peerServer = new WebSocketServer({ port: 0 })
    await new Promise<void>((resolve) => {
      peerServer.once('listening', () => resolve())
    })
    const { port } = peerServer.address() as AddressInfo
    const responses: string[] = []

    peerServer.on('connection', (socket) => {
      socket.on('message', (data) => {
        const { type } = JSON.parse(data.toString())
        if (type === 'AUTH_RESPONSE') responses.push(type)
        if (type !== 'AUTH_REQUEST') return
        for (let challenge = 0; challenge < 3; challenge += 1) {
          socket.send(JSON.stringify({ type: 'AUTH_CHALLENGE', challenge: createPeerChallenge() }))
        }
      })
    })

    await startNode({}, [`ws://localhost:${port}`])

    await vi.waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith('Ignored an unexpected AUTH_CHALLENGE')
    })
    await settle()
    expect(responses).toEqual(['AUTH_RESPONSE'])

    webSocketServers.splice(0).forEach((webSocketServer) => webSocketServer.close())
    for (const client of peerServer.clients) client.terminate()
    peerServer.close()
  })

  it('authenticates to a configured peer and then syncs its chain', async () => {
    const chainA = new Blockchain()
    chainA.addBlock([])
    const portA = await startNode({ getChain: () => chainA.chain })
    const onChain = vi.fn()

    await startNode({ onChain }, [`ws://localhost:${portA}`])

    await vi.waitFor(() => {
      expect(onChain).toHaveBeenCalledOnce()
    })
    expect(consoleWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('from an unauthenticated client'),
    )
  })
})
