import { describe, expect, it } from 'vitest'
import { Block } from './chain/block.js'
import { Blockchain } from './chain/blockchain.js'
import { parseWebSocketMessage } from './websocket-message.js'

const chainJson = (): unknown => JSON.parse(JSON.stringify(new Blockchain().chain))
const genesisJson = (): unknown => (chainJson() as unknown[])[0]

describe('parseWebSocketMessage', () => {
  it('accepts a CHAIN_REQUEST', () => {
    expect(parseWebSocketMessage(JSON.stringify({ type: 'CHAIN_REQUEST' }))).toEqual({
      ok: true,
      message: { type: 'CHAIN_REQUEST' },
    })
  })

  it('accepts a NEW_BLOCK with a well-formed block and returns a real Block', () => {
    const result = parseWebSocketMessage(
      JSON.stringify({ type: 'NEW_BLOCK', block: genesisJson() }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok || result.message.type !== 'NEW_BLOCK') throw new Error('expected NEW_BLOCK')
    expect(result.message.block).toBeInstanceOf(Block)
  })

  it('accepts a CHAIN_RESPONSE with a well-formed chain', () => {
    const result = parseWebSocketMessage(
      JSON.stringify({ type: 'CHAIN_RESPONSE', chain: chainJson() }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok || result.message.type !== 'CHAIN_RESPONSE') {
      throw new Error('expected CHAIN_RESPONSE')
    }
    expect(result.message.chain[0]).toBeInstanceOf(Block)
  })

  it('accepts an AUTH_REQUEST', () => {
    expect(parseWebSocketMessage(JSON.stringify({ type: 'AUTH_REQUEST' }))).toEqual({
      ok: true,
      message: { type: 'AUTH_REQUEST' },
    })
  })

  it('accepts an AUTH_CHALLENGE with a string challenge', () => {
    expect(
      parseWebSocketMessage(JSON.stringify({ type: 'AUTH_CHALLENGE', challenge: 'abc' })),
    ).toEqual({ ok: true, message: { type: 'AUTH_CHALLENGE', challenge: 'abc' } })
  })

  it('accepts an AUTH_RESPONSE with a public key and signature', () => {
    const message = { type: 'AUTH_RESPONSE', publicKey: 'key', signature: 'sig' }

    expect(parseWebSocketMessage(JSON.stringify(message))).toEqual({ ok: true, message })
  })

  it.each([
    ['invalid JSON', 'not json', 'invalid JSON'],
    ['a non-object', JSON.stringify(42), 'not an object'],
    ['null', 'null', 'not an object'],
    ['an array', '[]', 'not an object'],
    ['a missing type', JSON.stringify({}), 'unknown type'],
    ['an unknown type', JSON.stringify({ type: 'DROP_TABLES' }), 'unknown type'],
    ['a non-string type', JSON.stringify({ type: 7 }), 'unknown type'],
    ['a NEW_BLOCK without a block', JSON.stringify({ type: 'NEW_BLOCK' }), 'malformed NEW_BLOCK'],
    [
      'a NEW_BLOCK with a wrong-shape block',
      JSON.stringify({ type: 'NEW_BLOCK', block: { index: '1', hash: 'x' } }),
      'malformed NEW_BLOCK',
    ],
    [
      'a CHAIN_RESPONSE with a non-array chain',
      JSON.stringify({ type: 'CHAIN_RESPONSE', chain: {} }),
      'malformed CHAIN_RESPONSE',
    ],
    [
      'a CHAIN_RESPONSE with a wrong-shape block',
      JSON.stringify({ type: 'CHAIN_RESPONSE', chain: [{ index: 0 }] }),
      'malformed CHAIN_RESPONSE',
    ],
    [
      'an AUTH_CHALLENGE without a challenge',
      JSON.stringify({ type: 'AUTH_CHALLENGE' }),
      'malformed AUTH_CHALLENGE',
    ],
    [
      'an oversized AUTH_CHALLENGE',
      JSON.stringify({ type: 'AUTH_CHALLENGE', challenge: 'x'.repeat(10_000) }),
      'malformed AUTH_CHALLENGE',
    ],
    [
      'an AUTH_RESPONSE with a non-string signature',
      JSON.stringify({ type: 'AUTH_RESPONSE', publicKey: 'key', signature: 7 }),
      'malformed AUTH_RESPONSE',
    ],
    [
      'an oversized AUTH_RESPONSE public key',
      JSON.stringify({ type: 'AUTH_RESPONSE', publicKey: 'x'.repeat(10_000), signature: 'sig' }),
      'malformed AUTH_RESPONSE',
    ],
  ])('rejects %s', (_label, raw, reason) => {
    expect(parseWebSocketMessage(raw)).toEqual({ ok: false, reason })
  })
})
