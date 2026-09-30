import type { Block } from './chain/block.js'
import { parseChain } from './chain/chain-validation.js'

export const WEB_SOCKET_MESSAGE_TYPES = [
  'NEW_BLOCK',
  'CHAIN_REQUEST',
  'CHAIN_RESPONSE',
  'AUTH_REQUEST',
  'AUTH_CHALLENGE',
  'AUTH_RESPONSE',
] as const

export type WebSocketMessageType = (typeof WEB_SOCKET_MESSAGE_TYPES)[number]

export type WebSocketMessage =
  | { readonly type: 'NEW_BLOCK'; readonly block: Block }
  | { readonly type: 'CHAIN_REQUEST' }
  | { readonly type: 'CHAIN_RESPONSE'; readonly chain: readonly Block[] }
  | { readonly type: 'AUTH_REQUEST' }
  | { readonly type: 'AUTH_CHALLENGE'; readonly challenge: string }
  | { readonly type: 'AUTH_RESPONSE'; readonly publicKey: string; readonly signature: string }

const MAX_CHALLENGE_LENGTH = 128
const MAX_PUBLIC_KEY_LENGTH = 1024
const MAX_SIGNATURE_LENGTH = 256

function boundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

export type ParseWebSocketMessageResult =
  | { readonly ok: true; readonly message: WebSocketMessage }
  | { readonly ok: false; readonly reason: string }

function isWebSocketMessageType(value: unknown): value is WebSocketMessageType {
  return WEB_SOCKET_MESSAGE_TYPES.some((type) => type === value)
}

function parseJson(raw: string): { readonly ok: true; readonly value: unknown } | undefined {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return undefined
  }
}

const reject = (reason: string): ParseWebSocketMessageResult => ({ ok: false, reason })

export function parseWebSocketMessage(raw: string): ParseWebSocketMessageResult {
  const parsed = parseJson(raw)

  if (!parsed) {
    return reject('invalid JSON')
  }

  const value = parsed.value

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return reject('not an object')
  }

  const fields = value as Record<string, unknown>
  const type = fields.type

  if (!isWebSocketMessageType(type)) {
    return reject('unknown type')
  }

  switch (type) {
    case 'CHAIN_REQUEST':
      return { ok: true, message: { type } }
    case 'NEW_BLOCK': {
      const block = parseChain([fields.block])?.[0]
      return block ? { ok: true, message: { type, block } } : reject('malformed NEW_BLOCK')
    }
    case 'CHAIN_RESPONSE': {
      const chain = parseChain(fields.chain)
      return chain ? { ok: true, message: { type, chain } } : reject('malformed CHAIN_RESPONSE')
    }
    case 'AUTH_REQUEST':
      return { ok: true, message: { type } }
    case 'AUTH_CHALLENGE': {
      const challenge = fields.challenge
      return boundedString(challenge, MAX_CHALLENGE_LENGTH)
        ? { ok: true, message: { type, challenge } }
        : reject('malformed AUTH_CHALLENGE')
    }
    case 'AUTH_RESPONSE': {
      const { publicKey, signature } = fields
      return boundedString(publicKey, MAX_PUBLIC_KEY_LENGTH) &&
        boundedString(signature, MAX_SIGNATURE_LENGTH)
        ? { ok: true, message: { type, publicKey, signature } }
        : reject('malformed AUTH_RESPONSE')
    }
  }
}
