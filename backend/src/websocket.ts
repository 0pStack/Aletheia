import type { Server } from 'node:http'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import type { Block } from './chain/block.js'
import { parseWebSocketMessage, type WebSocketMessage } from './websocket-message.js'

export { WEB_SOCKET_MESSAGE_TYPES, type WebSocketMessageType } from './websocket-message.js'

export interface BroadcastWebSocketServer extends WebSocketServer {
  broadcast(message: unknown): void
}

export interface PeerHandlers {
  readonly onNewBlock?: (block: Block, requestChain: () => void) => void
  readonly getChain?: () => readonly Block[]
  readonly onChain?: (chain: readonly Block[]) => void
}

const PEER_RECONNECT_DELAY_MS = 1000

function send(socket: WebSocket, message: WebSocketMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message))
  }
}

export function attachWebSocketServer(
  server: Server,
  peers: string[] = [],
  handlers: PeerHandlers = {},
): BroadcastWebSocketServer {
  const sockets = new Set<WebSocket>()
  const peerSockets = new Set<WebSocket>()
  const awaitingChain = new WeakSet<WebSocket>()
  const webSocketServer = new WebSocketServer({ server }) as BroadcastWebSocketServer
  let closed = false

  // Event signatures are checked against the key inside the event, so a made-up chain
  // validates. Only a configured peer we asked may replace our chain.
  const requestChain = (socket: WebSocket): void => {
    awaitingChain.add(socket)
    send(socket, { type: 'CHAIN_REQUEST' })
  }

  const requestChainFromPeers = (): void => {
    for (const socket of peerSockets) {
      requestChain(socket)
    }
  }

  webSocketServer.broadcast = (message: unknown): void => {
    const payload = JSON.stringify(message)

    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload)
      }
    }
  }

  const handleMessage = (socket: WebSocket, data: RawData): void => {
    const result = parseWebSocketMessage(data.toString())

    if (!result.ok) {
      console.warn(`Invalid WebSocket message: ${result.reason}`)
      return
    }

    const message = result.message
    console.info(`WebSocket message received: ${message.type}`)

    switch (message.type) {
      case 'NEW_BLOCK':
        handlers.onNewBlock?.(message.block, requestChainFromPeers)
        return
      case 'CHAIN_REQUEST':
        if (handlers.getChain) {
          send(socket, { type: 'CHAIN_RESPONSE', chain: handlers.getChain() })
        }
        return
      case 'CHAIN_RESPONSE':
        if (!awaitingChain.delete(socket)) {
          console.warn('Ignored a CHAIN_RESPONSE that was not requested')
          return
        }
        handlers.onChain?.(message.chain)
        return
    }
  }

  const connectToPeer = (peer: string): void => {
    const socket = new WebSocket(peer)
    sockets.add(socket)
    peerSockets.add(socket)

    socket.on('open', () => {
      console.info(`Connected to peer: ${peer}`)
      requestChain(socket)
    })

    socket.on('message', (data) => handleMessage(socket, data))

    socket.on('close', () => {
      sockets.delete(socket)
      peerSockets.delete(socket)
      console.info(`Peer disconnected: ${peer}`)

      if (closed) {
        return
      }

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

    socket.on('message', (data) => handleMessage(socket, data))

    socket.on('close', () => {
      sockets.delete(socket)
      console.info('WebSocket client disconnected')
    })
  })

  // ws only emits 'close' once every inbound client has left, and a peer that lists us is
  // always one of them, so stopping has to happen when close() is called.
  const closeServer = webSocketServer.close.bind(webSocketServer)
  webSocketServer.close = (callback) => {
    closed = true

    for (const socket of peerSockets) {
      socket.terminate()
    }

    closeServer(callback)
  }

  return webSocketServer
}
