import type { Server } from 'node:http'
import { WebSocketServer } from 'ws'

export function attachWebSocketServer(server: Server): WebSocketServer {
  const webSocketServer = new WebSocketServer({ server })

  webSocketServer.on('connection', (socket) => {
    console.info('WebSocket client connected')

    socket.on('close', () => {
      console.info('WebSocket client disconnected')
    })
  })

  return webSocketServer
}
