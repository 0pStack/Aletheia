import type { Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { parseWebSocketMessage } from './websocket-message.js'

export { WEB_SOCKET_MESSAGE_TYPES, type WebSocketMessageType } from './websocket-message.js'

export interface BroadcastWebSocketServer extends WebSocketServer {
  broadcast(message: unknown): void
}

const PEER_RECONNECT_DELAY_MS = 1000

export function attachWebSocketServer(
  server: Server,
  peers: string[] = [],
  onNewBlock?: (block: import('./chain/block.js').Block) => void,
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

    socket.on('error', (error) => {
      console.error('Peer connection error:', peer, error)
    })
  }

  for (const peer of peers) {
    connectToPeer(peer)
  }

  webSocketServer.on('connection', (socket) => {
    sockets.add(socket)
    console.info('WebSocket client connected')

    socket.on('message', (data) => {
      const result = parseWebSocketMessage(data.toString())

      if (!result.ok) {
        console.warn(`Invalid WebSocket message: ${result.reason}`)
        return
      }

      console.info(`WebSocket message received: ${result.message.type}`)

      if (result.message.type === 'NEW_BLOCK') {
        onNewBlock?.(result.message.block)
      }
    })

    socket.on('close', () => {
      sockets.delete(socket)
      console.info('WebSocket client disconnected')
    })
  })

  return webSocketServer
}
