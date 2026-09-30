import { describe, expect, it } from 'vitest'
import type { AccessEvent } from './access-event.js'
import { signAccessEvent, verifyAccessEvent } from './access-event-signing.js'
import type { Block } from './block.js'
import { Blockchain } from './blockchain.js'
import { isValidIncomingChain } from './chain-validation.js'
import { generateKeyPair, type KeyPair } from './keypair.js'
import { createTrustedNodeKeys } from './trusted-node-keys.js'

const testEvent: AccessEvent = {
  id: 'event-1',
  patientId: 123,
  userId: 45,
  role: 'DOCTOR',
  action: 'READ',
  timestamp: '2026-09-29T10:00:00.000Z',
  serverId: 'server-3001',
}
const nodeKeys = generateKeyPair()
const strangerKeys = generateKeyPair()
const trustedKeys = createTrustedNodeKeys([nodeKeys.publicKey])

const signedBy = (keys: KeyPair, event: AccessEvent = testEvent): AccessEvent =>
  signAccessEvent(event, keys.privateKey, keys.publicKey)

function chainSignedBy(keys: KeyPair): Block[] {
  const peer = new Blockchain()
  peer.addBlock([signedBy(keys)])
  peer.addBlock([signedBy(keys, { ...testEvent, id: 'event-2' })])
  return peer.chain
}

describe('signatures from unknown node keys', () => {
  it('verifyAccessEvent rejects a self-signed event from an unknown key', () => {
    expect(verifyAccessEvent(signedBy(nodeKeys), trustedKeys)).toBe(true)
    expect(verifyAccessEvent(signedBy(strangerKeys), trustedKeys)).toBe(false)
  })

  it('isChainValid rejects a chain holding an event from an unknown key', () => {
    const blockchain = new Blockchain({ trustedKeys })
    blockchain.addBlock([signedBy(nodeKeys)])

    expect(blockchain.isChainValid()).toBe(true)

    blockchain.addBlock([signedBy(strangerKeys, { ...testEvent, id: 'event-2' })])

    expect(blockchain.isChainValid()).toBe(false)
    expect(blockchain.findFirstInvalidBlockIndex()).toBe(2)
  })

  it('acceptBlock rejects a block holding an event from an unknown key', () => {
    const blockchain = new Blockchain({ trustedKeys })
    const forgedBlock = new Blockchain().addBlock([signedBy(strangerKeys)])

    expect(blockchain.acceptBlock(forgedBlock)).toBe(false)
    expect(blockchain.chain).toHaveLength(1)
  })

  it('acceptBlock still accepts a block signed by a known key', () => {
    const blockchain = new Blockchain({ trustedKeys })
    const block = new Blockchain().addBlock([signedBy(nodeKeys)])

    expect(blockchain.acceptBlock(block)).toBe(true)
  })

  it('replaceChain rejects a longer chain signed by an unknown key', () => {
    const blockchain = new Blockchain({ trustedKeys })

    expect(blockchain.replaceChain(chainSignedBy(strangerKeys))).toBe(false)
    expect(blockchain.chain).toHaveLength(1)
  })

  it('replaceChain still accepts a longer chain signed by a known key', () => {
    const blockchain = new Blockchain({ trustedKeys })

    expect(blockchain.replaceChain(chainSignedBy(nodeKeys))).toBe(true)
  })

  it('isValidIncomingChain rejects a chain signed by an unknown key', () => {
    const ourGenesis = new Blockchain().chain[0] as Block

    expect(isValidIncomingChain(chainSignedBy(nodeKeys), ourGenesis, trustedKeys)).toBe(true)
    expect(isValidIncomingChain(chainSignedBy(strangerKeys), ourGenesis, trustedKeys)).toBe(false)
  })
})
