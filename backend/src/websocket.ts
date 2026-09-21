import type { Server } from 'node:http'
import { WebSocketServer } from 'ws'

export function attachWebSocketServer(server: Server): WebSocketServer {
  return new WebSocketServer({ server })
}
