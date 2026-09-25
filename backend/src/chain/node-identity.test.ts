import { describe, expect, it, vi } from 'vitest'
import { loadOrCreateKeyPair } from './keypair-storage.js'
import { loadNodeKeyPair } from './node-identity.js'

vi.mock('./keypair-storage.js', () => ({
  loadOrCreateKeyPair: vi.fn(() => ({ publicKey: 'public', privateKey: 'private' })),
}))

describe('loadNodeKeyPair', () => {
  it('loads the node key pair from keys/node-key', () => {
    expect(loadNodeKeyPair()).toEqual({ publicKey: 'public', privateKey: 'private' })
    expect(loadOrCreateKeyPair).toHaveBeenCalledWith('./keys/node-key')
  })
})
