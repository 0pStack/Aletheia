import { createServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { describe, expect, it, vi } from 'vitest'
import type { Block } from './chain/block.js'
import { Blockchain } from './chain/blockchain.js'
import { attachWebSocketServer } from './websocket.js'

describe('attachWebSocketServer', () => {
  it('connects to configured peers', async () => {
    const server = createServer()
    const peerServer = new WebSocketServer({ port: 0 })
    const peerConnected = new Promise<void>((resolve) => {
      peerServer.once('connection', () => resolve())
    })

    await new Promise<void>((resolve) => {
      peerServer.once('listening', () => resolve())
    })

    const address = peerServer.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine peer server port')
    }

    const peerUrl = `ws://localhost:${address.port}`
    const webSocketServer = attachWebSocketServer(server, [peerUrl])

    await peerConnected

    webSocketServer.close()
    peerServer.close()
    server.close()
  })

  it('reconnects to a peer after the connection closes', async () => {
    const server = createServer()
    const peerServer = new WebSocketServer({ port: 0 })

    await new Promise<void>((resolve) => {
      peerServer.once('listening', () => resolve())
    })

    const address = peerServer.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine peer server port')
    }

    const peerUrl = `ws://localhost:${address.port}`
    const firstConnection = new Promise<WebSocket>((resolve) => {
      peerServer.once('connection', (socket) => resolve(socket))
    })

    const webSocketServer = attachWebSocketServer(server, [peerUrl])

    const firstSocket = await firstConnection
    firstSocket.close()

    const secondConnection = new Promise<void>((resolve) => {
      peerServer.once('connection', () => resolve())
    })

    await secondConnection

    webSocketServer.close()
    peerServer.close()
    server.close()
  })

  it('attaches a WebSocket server to the HTTP server', () => {
    const server = createServer()
    const webSocketServer = attachWebSocketServer(server)

    expect(webSocketServer).toBeDefined()
    expect(webSocketServer.options.server).toBe(server)

    webSocketServer.close()
    server.close()
  })

  it('logs when a client connects and disconnects', async () => {
    const server = createServer()
    const webSocketServer = attachWebSocketServer(server)
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })

    const address = server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine server port')
    }

    const socket = new WebSocket(`ws://localhost:${address.port}`)

    await new Promise<void>((resolve) => {
      socket.once('open', () => resolve())
    })

    expect(consoleInfo).toHaveBeenCalledWith('WebSocket client connected')

    socket.close()

    await vi.waitFor(() => {
      expect(consoleInfo).toHaveBeenCalledWith('WebSocket client disconnected')
    })

    consoleInfo.mockRestore()
    webSocketServer.close()
    server.close()
  })

  it('parses a JSON message and reads its type', async () => {
    const server = createServer()
    const webSocketServer = attachWebSocketServer(server)
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })

    const address = server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine server port')
    }

    const socket = new WebSocket(`ws://localhost:${address.port}`)

    await new Promise<void>((resolve) => {
      socket.once('open', () => resolve())
    })

    socket.send(JSON.stringify({ type: 'CHAIN_REQUEST' }))

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(consoleInfo).toHaveBeenCalledWith('WebSocket message received: CHAIN_REQUEST')

    socket.close()
    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve())
    })

    consoleInfo.mockRestore()
    webSocketServer.close()
    server.close()
  })

  it('does not crash when receiving invalid JSON', async () => {
    const server = createServer()
    const webSocketServer = attachWebSocketServer(server)
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })

    const address = server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine server port')
    }

    const socket = new WebSocket(`ws://localhost:${address.port}`)

    await new Promise<void>((resolve) => {
      socket.once('open', () => resolve())
    })

    socket.send('this is not valid JSON')

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(consoleWarn).toHaveBeenCalledWith('Invalid WebSocket message: invalid JSON')

    expect(socket.readyState).toBe(WebSocket.OPEN)

    socket.close()
    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve())
    })

    consoleInfo.mockRestore()
    consoleWarn.mockRestore()
    webSocketServer.close()
    server.close()
  })

  it('broadcasts a NEW_BLOCK message to connected peers', async () => {
    const server = createServer()
    const webSocketServer = attachWebSocketServer(server)

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })

    const address = server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine server port')
    }

    const socket = new WebSocket(`ws://localhost:${address.port}`)

    await new Promise<void>((resolve) => {
      socket.once('open', () => resolve())
    })

    const block = {
      index: 1,
      hash: 'test-hash',
    }

    const messageReceived = new Promise<string>((resolve) => {
      socket.once('message', (data) => resolve(data.toString()))
    })

    webSocketServer.broadcast({
      type: 'NEW_BLOCK',
      block,
    })

    const message = JSON.parse(await messageReceived)

    expect(message).toEqual({
      type: 'NEW_BLOCK',
      block,
    })

    socket.close()
    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve())
    })

    webSocketServer.close()
    server.close()
  })

  it('passes a received NEW_BLOCK to the handler', async () => {
    const server = createServer()
    const onNewBlock = vi.fn()
    const webSocketServer = attachWebSocketServer(server, [], { onNewBlock })

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })

    const address = server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine server port')
    }

    const socket = new WebSocket(`ws://localhost:${address.port}`)

    await new Promise<void>((resolve) => {
      socket.once('open', () => resolve())
    })

    const block = {
      index: 1,
      timestamp: '2026-09-25T10:00:00.000Z',
      data: [],
      previousHash: 'abc',
      merkleRoot: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      hash: 'test-hash',
      nonce: 0,
    }

    socket.send(JSON.stringify({ type: 'NEW_BLOCK', block }))

    await vi.waitFor(() => {
      expect(onNewBlock).toHaveBeenCalledOnce()
    })

    expect(onNewBlock.mock.calls[0]?.[0]).toMatchObject(block)

    socket.close()
    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve())
    })

    webSocketServer.close()
    server.close()
  })

  it('answers a CHAIN_REQUEST with its chain', async () => {
    const server = createServer()
    const chain = new Blockchain().chain
    const webSocketServer = attachWebSocketServer(server, [], { getChain: () => chain })

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })

    const address = server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine server port')
    }

    const socket = new WebSocket(`ws://localhost:${address.port}`)

    await new Promise<void>((resolve) => {
      socket.once('open', () => resolve())
    })

    const reply = new Promise<string>((resolve) => {
      socket.once('message', (data) => resolve(data.toString()))
    })

    socket.send(JSON.stringify({ type: 'CHAIN_REQUEST' }))

    expect(JSON.parse(await reply)).toEqual(
      JSON.parse(JSON.stringify({ type: 'CHAIN_RESPONSE', chain })),
    )

    socket.close()
    webSocketServer.close()
    server.close()
  })

  it('requests the chain from a peer it connects to and passes the answer on', async () => {
    const server = createServer()
    const peerServer = new WebSocketServer({ port: 0 })
    const chain = new Blockchain().chain

    peerServer.on('connection', (socket) => {
      socket.on('message', (data) => {
        if (JSON.parse(data.toString()).type === 'CHAIN_REQUEST') {
          socket.send(JSON.stringify({ type: 'CHAIN_RESPONSE', chain }))
        }
      })
    })

    await new Promise<void>((resolve) => {
      peerServer.once('listening', () => resolve())
    })

    const address = peerServer.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine peer server port')
    }

    const onChain = vi.fn()
    const webSocketServer = attachWebSocketServer(server, [`ws://localhost:${address.port}`], {
      onChain,
    })

    await vi.waitFor(() => {
      expect(onChain).toHaveBeenCalledOnce()
    })

    expect(onChain.mock.calls[0]?.[0].map((block: Block) => block.hash)).toEqual(
      chain.map((block) => block.hash),
    )

    webSocketServer.close()
    for (const client of peerServer.clients) {
      client.terminate()
    }
    peerServer.close()
    server.close()
  })

  it('stops reconnecting to peers once closed, even while that peer is still connected in', async () => {
    const server = createServer()
    const peerServer = new WebSocketServer({ port: 0 })

    await new Promise<void>((resolve) => {
      peerServer.once('listening', () => resolve())
    })
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })

    const peerAddress = peerServer.address()
    const ourAddress = server.address()

    if (
      !peerAddress ||
      typeof peerAddress === 'string' ||
      !ourAddress ||
      typeof ourAddress === 'string'
    ) {
      throw new Error('Could not determine ports')
    }

    let connections = 0
    const firstConnection = new Promise<void>((resolve) => {
      peerServer.on('connection', () => {
        connections += 1
        resolve()
      })
    })

    const webSocketServer = attachWebSocketServer(server, [`ws://localhost:${peerAddress.port}`])
    const inboundFromPeer = new WebSocket(`ws://localhost:${ourAddress.port}`)

    await firstConnection
    await new Promise<void>((resolve) => {
      inboundFromPeer.once('open', () => resolve())
    })

    webSocketServer.close()
    await new Promise((resolve) => setTimeout(resolve, 2500))

    expect(connections).toBe(1)
    expect(peerServer.clients.size).toBe(0)

    inboundFromPeer.terminate()
    peerServer.close()
    server.close()
  })

  it('logs the actual error when a peer connection fails', async () => {
    const server = createServer()
    const unusedServer = new WebSocketServer({ port: 0 })

    await new Promise<void>((resolve) => {
      unusedServer.once('listening', () => resolve())
    })

    const address = unusedServer.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine unused port')
    }

    await new Promise<void>((resolve) => {
      unusedServer.close(() => resolve())
    })

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const peerUrl = `ws://localhost:${address.port}`
    const webSocketServer = attachWebSocketServer(server, [peerUrl])

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Peer connection error:',
        peerUrl,
        expect.any(Error),
      )
    })

    consoleError.mockRestore()
    consoleInfo.mockRestore()
    webSocketServer.close()
    server.close()
  })

  it.each([
    ['an unknown type', { type: 'DROP_TABLES' }, 'unknown type'],
    [
      'a wrong-shape NEW_BLOCK',
      { type: 'NEW_BLOCK', block: { index: 'x' } },
      'malformed NEW_BLOCK',
    ],
  ])('rejects %s without processing it', async (_label, payload, reason) => {
    const server = createServer()
    const webSocketServer = attachWebSocketServer(server)
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })

    const address = server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine server port')
    }

    const socket = new WebSocket(`ws://localhost:${address.port}`)

    await new Promise<void>((resolve) => {
      socket.once('open', () => resolve())
    })

    socket.send(JSON.stringify(payload))

    await vi.waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith(`Invalid WebSocket message: ${reason}`)
    })

    expect(consoleInfo).not.toHaveBeenCalledWith(
      expect.stringContaining('WebSocket message received'),
    )
    expect(socket.readyState).toBe(WebSocket.OPEN)

    socket.close()
    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve())
    })

    consoleInfo.mockRestore()
    consoleWarn.mockRestore()
    webSocketServer.close()
    server.close()
  })
})
