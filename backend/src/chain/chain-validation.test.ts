import { describe, expect, it } from 'vitest'
import type { AccessEvent } from './access-event.js'
import { signAccessEvent } from './access-event-signing.js'
import { Block } from './block.js'
import { Blockchain } from './blockchain.js'
import { findFirstInvalidBlockIndex, isValidIncomingChain, parseChain } from './chain-validation.js'
import { generateKeyPair } from './keypair.js'

const testEvent: AccessEvent = {
  id: 'event-1',
  patientId: 123,
  userId: 45,
  role: 'DOCTOR',
  action: 'READ',
  timestamp: '2026-09-25T10:00:00.000Z',
  serverId: 'server-3002',
}
const testKeys = generateKeyPair()
const signed = (event: AccessEvent): AccessEvent =>
  signAccessEvent(event, testKeys.privateKey, testKeys.publicKey)

const ourGenesis = new Blockchain().chain[0] as Block

function peerChainJson(): unknown {
  const peer = new Blockchain()
  peer.addBlock([signed(testEvent)])
  peer.addBlock([signed({ ...testEvent, id: 'event-2' }), signed({ ...testEvent, id: 'event-3' })])
  return JSON.parse(JSON.stringify(peer.chain))
}

function parsedPeerChain(): Block[] {
  const chain = parseChain(peerChainJson())
  if (!chain) throw new Error('expected the peer chain to parse')
  return chain
}

describe('parseChain', () => {
  it('turns JSON into real Block instances', () => {
    const chain = parsedPeerChain()

    expect(chain).toHaveLength(3)
    expect(chain.every((block) => block instanceof Block)).toBe(true)
  })

  it('returns undefined for something that is not a chain', () => {
    expect(parseChain('not a chain')).toBeUndefined()
    expect(parseChain([{ index: 0 }])).toBeUndefined()
    expect(parseChain([{ ...(peerChainJson() as object[])[0], data: [null] }])).toBeUndefined()
  })
})

describe('isValidIncomingChain', () => {
  it('accepts a valid chain from a peer', () => {
    expect(isValidIncomingChain(parsedPeerChain(), ourGenesis)).toBe(true)
  })

  it('rejects an empty chain', () => {
    expect(isValidIncomingChain([], ourGenesis)).toBe(false)
  })

  it('rejects a chain with a different genesis block', () => {
    const foreignGenesis = new Block(0, '2020-01-01T00:00:00.000Z', [], '0', 0)

    expect(isValidIncomingChain([foreignGenesis], ourGenesis)).toBe(false)
  })

  it('rejects a chain where an event was edited', () => {
    const json = peerChainJson() as { data: { action: string }[] }[]
    const event = json[1]?.data[0]
    if (!event) throw new Error('expected an event in block 1')
    event.action = 'WRITE'

    const chain = parseChain(json) ?? []

    expect(isValidIncomingChain(chain, ourGenesis)).toBe(false)
  })

  it('rejects a chain with a broken link', () => {
    const chain = parsedPeerChain()
    const block = chain[2] as Block
    block.previousHash = 'f'.repeat(64)
    block.hash = block.calculateHash()

    expect(isValidIncomingChain(chain, ourGenesis)).toBe(false)
  })

  it('rejects a chain with a block missing in the middle', () => {
    const chain = parsedPeerChain()

    expect(isValidIncomingChain([chain[0] as Block, chain[2] as Block], ourGenesis)).toBe(false)
  })

  it('rejects a chain containing an unsigned event', () => {
    const peer = new Blockchain()
    peer.addBlock([testEvent])

    expect(isValidIncomingChain(peer.chain, ourGenesis)).toBe(false)
  })

  it('rejects a chain that carries patient data', () => {
    const peer = new Blockchain()
    const leaky = { ...signed(testEvent), patientName: 'Anna Andersson' } as AccessEvent
    peer.addBlock([leaky])

    expect(isValidIncomingChain(peer.chain, ourGenesis)).toBe(false)
  })
})

describe('findFirstInvalidBlockIndex', () => {
  it('points at the first bad block', () => {
    const chain = parsedPeerChain()
    const block = chain[1] as Block
    block.merkleRoot = 'f'.repeat(64)

    expect(findFirstInvalidBlockIndex(chain)).toBe(1)
  })

  it('returns null for a valid chain', () => {
    expect(findFirstInvalidBlockIndex(parsedPeerChain())).toBeNull()
  })
})
