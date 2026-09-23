import type { Server } from 'node:http'
import { WebSocketServer } from 'ws'

export const WEB_SOCKET_MESSAGE_TYPES = ['NEW_BLOCK', 'CHAIN_REQUEST', 'CHAIN_RESPONSE'] as const

export type WebSocketMessageType = (typeof WEB_SOCKET_MESSAGE_TYPES)[number]

export function attachWebSocketServer(server: Server, peers: string[] = []): WebSocketServer {
  const webSocketServer = new WebSocketServer({ server })

  webSocketServer.on('connection', (socket) => {
    console.info('WebSocket client connected')

    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as {
          type?: WebSocketMessageType
        }

        console.info(`WebSocket message received: ${message.type}`)
      } catch {
        console.info('Invalid WebSocket message')
      }
    })

    socket.on('close', () => {
      console.info('WebSocket client disconnected')
    })
  })

  return webSocketServer
}
