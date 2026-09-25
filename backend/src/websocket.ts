import type { Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'

export const WEB_SOCKET_MESSAGE_TYPES = ['NEW_BLOCK', 'CHAIN_REQUEST', 'CHAIN_RESPONSE'] as const

export type WebSocketMessageType = (typeof WEB_SOCKET_MESSAGE_TYPES)[number]

export interface BroadcastWebSocketServer extends WebSocketServer {
  broadcast(message: unknown): void
}

const PEER_RECONNECT_DELAY_MS = 1000

export function attachWebSocketServer(
  server: Server,
  peers: string[] = [],
): BroadcastWebSocketServer {
  const sockets = new Set<WebSocket>()
  const webSocketServer = new WebSocketServer({ server }) as BroadcastWebSocketServer

  webSocketServer.broadcast = (message: unknown): void => {
    const payload = JSON.stringify(message)

    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload)
      }
    }
  }

  const connectToPeer = (peer: string): void => {
    const socket = new WebSocket(peer)
    sockets.add(socket)

    socket.on('open', () => {
      console.info(`Connected to peer: ${peer}`)
    })

    socket.on('close', () => {
      sockets.delete(socket)
      console.info(`Peer disconnected: ${peer}`)

      setTimeout(() => {
        connectToPeer(peer)
      }, PEER_RECONNECT_DELAY_MS)
    })

    socket.on('error', () => {
      console.info(`Peer connection error: ${peer}`)
    })
  }

  for (const peer of peers) {
    connectToPeer(peer)
  }

  webSocketServer.on('connection', (socket) => {
    sockets.add(socket)
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
      sockets.delete(socket)
      console.info('WebSocket client disconnected')
    })
  })

  return webSocketServer
}
