import { createServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Block } from './chain/block.js'
import { Blockchain } from './chain/blockchain.js'
import { attachWebSocketServer, CHAIN_REQUEST_LIMIT } from './websocket.js'

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

  it.each([
    ['without asking first', false],
    ['after sending a NEW_BLOCK that is far ahead', true],
  ])(
    'ignores a CHAIN_RESPONSE from a client that connected in %s',
    async (_label, sendsNewBlockFirst) => {
      const server = createServer()
      const onChain = vi.fn()
      const onNewBlock = vi.fn((_block: Block, requestChain: () => void) => requestChain())
      const webSocketServer = attachWebSocketServer(server, [], { onChain, onNewBlock })
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
      const forged = new Blockchain()
      forged.addBlock([])

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

      if (sendsNewBlockFirst) {
        socket.send(JSON.stringify({ type: 'NEW_BLOCK', block: forged.getLatestBlock() }))
      }
      socket.send(JSON.stringify({ type: 'CHAIN_RESPONSE', chain: forged.chain }))

      await vi.waitFor(() => {
        expect(consoleWarn).toHaveBeenCalledWith('Ignored a CHAIN_RESPONSE that was not requested')
      })
      expect(onChain).not.toHaveBeenCalled()

      socket.close()
      consoleWarn.mockRestore()
      consoleInfo.mockRestore()
      webSocketServer.close()
      server.close()
    },
  )

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

  describe('peer reconnect backoff', () => {
    // setImmediate stays real so socket I/O can be awaited while the reconnect timers are fake.
    const waitUntil = (predicate: () => boolean): Promise<void> =>
      new Promise((resolve) => {
        const check = (): void => {
          if (predicate()) {
            resolve()
          } else {
            setImmediate(check)
          }
        }
        check()
      })

    const listeningPeerServer = async (): Promise<{ peerServer: WebSocketServer; url: string }> => {
      const peerServer = new WebSocketServer({ port: 0 })

      await new Promise<void>((resolve) => {
        peerServer.once('listening', () => resolve())
      })

      const address = peerServer.address()

      if (!address || typeof address === 'string') {
        throw new Error('Could not determine peer server port')
      }

      return { peerServer, url: `ws://localhost:${address.port}` }
    }

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('waits longer after every failed attempt while a peer stays unreachable', async () => {
      const server = createServer()
      const { peerServer, url } = await listeningPeerServer()
      await new Promise<void>((resolve) => {
        peerServer.close(() => resolve())
      })

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      vi.spyOn(Math, 'random').mockReturnValue(0)
      vi.spyOn(console, 'info').mockImplementation(() => undefined)
      let failures = 0
      vi.spyOn(console, 'error').mockImplementation(() => {
        failures += 1
      })

      const webSocketServer = attachWebSocketServer(server, [url])

      for (const [attempt, delay] of [500, 1000, 2000].entries()) {
        await waitUntil(() => failures === attempt + 1 && vi.getTimerCount() === 1)

        await vi.advanceTimersByTimeAsync(delay - 1)
        expect(vi.getTimerCount()).toBe(1)

        await vi.advanceTimersByTimeAsync(1)
        expect(vi.getTimerCount()).toBe(0)
      }

      await waitUntil(() => failures === 4)

      webSocketServer.close()
      expect(vi.getTimerCount()).toBe(0)
      server.close()
    })

    it('starts over from the shortest delay after a connection succeeds', async () => {
      const server = createServer()
      const { peerServer, url } = await listeningPeerServer()

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      vi.spyOn(Math, 'random').mockReturnValue(0)
      let opens = 0
      vi.spyOn(console, 'info').mockImplementation((message: unknown) => {
        if (message === `Connected to peer: ${url}`) {
          opens += 1
        }
      })

      const webSocketServer = attachWebSocketServer(server, [url])

      for (const expectedOpens of [1, 2, 3]) {
        await waitUntil(() => opens === expectedOpens)
        for (const client of peerServer.clients) {
          client.terminate()
        }
        await waitUntil(() => vi.getTimerCount() === 1)

        await vi.advanceTimersByTimeAsync(499)
        expect(vi.getTimerCount()).toBe(1)

        await vi.advanceTimersByTimeAsync(1)
        expect(vi.getTimerCount()).toBe(0)
      }

      webSocketServer.close()
      peerServer.close()
      server.close()
    })
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

  it('answers at most the allowed number of CHAIN_REQUESTs in a burst from one socket', async () => {
    const server = createServer()
    const chain = new Blockchain().chain
    const webSocketServer = attachWebSocketServer(server, [], { getChain: () => chain })
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })

    const address = server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine server port')
    }

    const socket = new WebSocket(`ws://localhost:${address.port}`)
    const replies: string[] = []
    socket.on('message', (data) => replies.push(data.toString()))

    await new Promise<void>((resolve) => {
      socket.once('open', () => resolve())
    })

    for (let request = 0; request < CHAIN_REQUEST_LIMIT * 4; request += 1) {
      socket.send(JSON.stringify({ type: 'CHAIN_REQUEST' }))
    }

    await vi.waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith('Rate limited a CHAIN_REQUEST')
    })
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100)
    })

    expect(replies).toHaveLength(CHAIN_REQUEST_LIMIT)

    socket.close()
    consoleWarn.mockRestore()
    webSocketServer.close()
    server.close()
  })

  it('serializes the chain once until it changes', async () => {
    const server = createServer()
    const blockchain = new Blockchain()
    const webSocketServer = attachWebSocketServer(server, [], {
      getChain: () => [...blockchain.chain],
    })
    const stringify = vi.spyOn(JSON, 'stringify')
    const chainResponsesSerialized = (): number =>
      stringify.mock.calls.filter(
        ([value]) =>
          typeof value === 'object' &&
          value !== null &&
          'type' in value &&
          value.type === 'CHAIN_RESPONSE',
      ).length

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })

    const address = server.address()

    if (!address || typeof address === 'string') {
      throw new Error('Could not determine server port')
    }

    const socket = new WebSocket(`ws://localhost:${address.port}`)
    const replies: string[] = []
    socket.on('message', (data) => replies.push(data.toString()))

    await new Promise<void>((resolve) => {
      socket.once('open', () => resolve())
    })

    socket.send(JSON.stringify({ type: 'CHAIN_REQUEST' }))
    socket.send(JSON.stringify({ type: 'CHAIN_REQUEST' }))
    await vi.waitFor(() => {
      expect(replies).toHaveLength(2)
    })

    expect(chainResponsesSerialized()).toBe(1)

    blockchain.addBlock([])
    socket.send(JSON.stringify({ type: 'CHAIN_REQUEST' }))
    await vi.waitFor(() => {
      expect(replies).toHaveLength(3)
    })

    expect(chainResponsesSerialized()).toBe(2)
    expect(JSON.parse(replies[2] ?? '')).toEqual(
      JSON.parse(JSON.stringify({ type: 'CHAIN_RESPONSE', chain: blockchain.chain })),
    )

    stringify.mockRestore()
    socket.close()
    webSocketServer.close()
    server.close()
  })
})
