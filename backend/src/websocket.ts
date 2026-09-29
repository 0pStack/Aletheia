import type { Server } from 'node:http'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import type { Block } from './chain/block.js'
import { peerReconnectDelay } from './peer-reconnect.js'
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

export const CHAIN_REQUEST_LIMIT = 5
const CHAIN_REQUEST_WINDOW_MS = 10_000

// A signed block serialises to about 0.7 KB, so a CHAIN_RESPONSE fits roughly
// 7,000 blocks, while a peer can no longer make us buffer and JSON.parse ws's 100 MiB default.
export const MAX_WEB_SOCKET_PAYLOAD_BYTES = 5 * 1024 * 1024

const WS_ERR_MESSAGE_TOO_BIG = 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'

function isOversizeMessageError(error: Error): boolean {
  return 'code' in error && error.code === WS_ERR_MESSAGE_TOO_BIG
}

function warnOversizeMessage(source: string): void {
  console.warn(
    `Rejected oversize WebSocket message from ${source} (limit ${MAX_WEB_SOCKET_PAYLOAD_BYTES} bytes)`,
  )
}

function send(socket: WebSocket, message: WebSocketMessage): void {
  sendPayload(socket, JSON.stringify(message))
}

function sendPayload(socket: WebSocket, payload: string): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(payload)
  }
}

// Blocks are hash-linked and a chain is only ever replaced by a longer one, so the length
// and tip hash identify its contents without serializing it.
function chainKey(chain: readonly Block[]): string {
  return `${chain.length}:${chain[chain.length - 1]?.hash ?? ''}`
}

export function attachWebSocketServer(
  server: Server,
  peers: string[] = [],
  handlers: PeerHandlers = {},
): BroadcastWebSocketServer {
  const sockets = new Set<WebSocket>()
  const peerSockets = new Set<WebSocket>()
  const awaitingChain = new WeakSet<WebSocket>()
  const reconnectTimers = new Set<ReturnType<typeof setTimeout>>()
  const chainRequestTimes = new WeakMap<WebSocket, readonly number[]>()
  let cachedChainResponse: { readonly key: string; readonly payload: string } | null = null
  const webSocketServer = new WebSocketServer({
    server,
    maxPayload: MAX_WEB_SOCKET_PAYLOAD_BYTES,
  }) as BroadcastWebSocketServer
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

  const allowChainRequest = (socket: WebSocket): boolean => {
    const now = Date.now()
    const recent = (chainRequestTimes.get(socket) ?? []).filter(
      (time) => now - time < CHAIN_REQUEST_WINDOW_MS,
    )

    if (recent.length >= CHAIN_REQUEST_LIMIT) {
      chainRequestTimes.set(socket, recent)
      return false
    }

    chainRequestTimes.set(socket, [...recent, now])
    return true
  }

  const chainResponsePayload = (chain: readonly Block[]): string => {
    const key = chainKey(chain)

    if (cachedChainResponse?.key !== key) {
      const message: WebSocketMessage = { type: 'CHAIN_RESPONSE', chain }
      cachedChainResponse = { key, payload: JSON.stringify(message) }
    }

    return cachedChainResponse.payload
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
        if (!handlers.getChain) {
          return
        }
        if (!allowChainRequest(socket)) {
          console.warn('Rate limited a CHAIN_REQUEST')
          return
        }
        sendPayload(socket, chainResponsePayload(handlers.getChain()))
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

  const connectToPeer = (peer: string, attempt = 0): void => {
    const socket = new WebSocket(peer, { maxPayload: MAX_WEB_SOCKET_PAYLOAD_BYTES })
    sockets.add(socket)
    peerSockets.add(socket)
    let opened = false

    socket.on('open', () => {
      opened = true
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

      const failedAttempts = opened ? 0 : attempt
      const timer = setTimeout(() => {
        reconnectTimers.delete(timer)
        connectToPeer(peer, failedAttempts + 1)
      }, peerReconnectDelay(failedAttempts))
      reconnectTimers.add(timer)
    })

    socket.on('error', (error) => {
      if (isOversizeMessageError(error)) {
        warnOversizeMessage(`peer ${peer}`)
        return
      }

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

    socket.on('error', (error) => {
      if (isOversizeMessageError(error)) {
        warnOversizeMessage('client')
        return
      }

      console.error('WebSocket client error:', error)
    })
  })

  // ws only emits 'close' once every inbound client has left, and a peer that lists us is
  // always one of them, so stopping has to happen when close() is called.
  const closeServer = webSocketServer.close.bind(webSocketServer)
  webSocketServer.close = (callback) => {
    closed = true

    for (const timer of reconnectTimers) {
      clearTimeout(timer)
    }
    reconnectTimers.clear()

    for (const socket of peerSockets) {
      socket.terminate()
    }

    closeServer(callback)
  }

  return webSocketServer
}
