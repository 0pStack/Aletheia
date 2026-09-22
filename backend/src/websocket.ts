import type { Server } from 'node:http'
import { WebSocketServer } from 'ws'

export const WEB_SOCKET_MESSAGE_TYPES = [
  'NEW_BLOCK',
  'CHAIN_REQUEST',
  'CHAIN_RESPONSE',
] as const

export type WebSocketMessageType = (typeof WEB_SOCKET_MESSAGE_TYPES)[number]

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
