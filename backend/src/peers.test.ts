import { describe, expect, it } from 'vitest'
import { resolvePeers } from './peers.js'

describe('resolvePeers', () => {
  it('returns an empty array when PEERS is missing', () => {
    expect(resolvePeers(undefined)).toEqual([])
  })

  it('parses a single peer', () => {
    expect(resolvePeers('ws://localhost:3002')).toEqual(['ws://localhost:3002'])
  })

  it('parses multiple comma-separated peers', () => {
    expect(resolvePeers('ws://localhost:3002, ws://localhost:3003')).toEqual([
      'ws://localhost:3002',
      'ws://localhost:3003',
    ])
  })

  it('trims whitespace and ignores empty values', () => {
    expect(resolvePeers(' ws://localhost:3002, , ws://localhost:3003 ')).toEqual([
      'ws://localhost:3002',
      'ws://localhost:3003',
    ])
  })
})
