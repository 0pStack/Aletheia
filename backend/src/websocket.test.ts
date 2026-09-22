import { createServer } from 'node:http'
import { WebSocket } from 'ws'
import { describe, expect, it, vi } from 'vitest'
import { attachWebSocketServer } from './websocket.js'

describe('attachWebSocketServer', () => {
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
    const consoleInfo = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined)

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

    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve())
    })

    expect(consoleInfo).toHaveBeenCalledWith(
      'WebSocket client disconnected',
    )

    consoleInfo.mockRestore()
    webSocketServer.close()
    server.close()
  })
})
