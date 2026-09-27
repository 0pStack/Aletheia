import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Blockchain } from './chain/blockchain.js'
import { createChainSyncHandlers } from './peer-sync.js'
import { attachWebSocketServer, type BroadcastWebSocketServer } from './websocket.js'

interface TestNode {
  readonly blockchain: Blockchain
  readonly url: string
  readonly webSocketServer: BroadcastWebSocketServer
  close(): void
}

async function startNode(blockchain: Blockchain, peers: string[] = []): Promise<TestNode> {
  const server = createServer()
  const webSocketServer = attachWebSocketServer(server, peers, createChainSyncHandlers(blockchain))

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve())
  })

  const { port } = server.address() as AddressInfo

  return {
    blockchain,
    url: `ws://localhost:${port}`,
    webSocketServer,
    close: () => {
      for (const client of webSocketServer.clients) {
        client.terminate()
      }
      webSocketServer.close()
      server.close()
    },
  }
}

function chainWithBlocks(count: number): Blockchain {
  const blockchain = new Blockchain()
  for (let i = 0; i < count; i++) {
    blockchain.addBlock([])
  }
  return blockchain
}

const hashes = (blockchain: Blockchain): string[] => blockchain.chain.map((block) => block.hash)

describe('chain sync between nodes', () => {
  const nodes: TestNode[] = []

  const start = async (blockchain: Blockchain, peers: string[] = []): Promise<TestNode> => {
    const node = await startNode(blockchain, peers)
    nodes.push(node)
    return node
  }

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    for (const node of nodes.splice(0)) {
      node.close()
    }
    vi.restoreAllMocks()
  })

  it('a node that was offline catches up when it reconnects', async () => {
    const node1 = await start(new Blockchain())
    const node2 = await start(new Blockchain(), [node1.url])
    const savedNode2Chain = [...node2.blockchain.chain]

    node2.close()
    node1.blockchain.addBlock([])
    node1.blockchain.addBlock([])
    node1.blockchain.addBlock([])

    const restartedNode2 = await start(new Blockchain({ chain: savedNode2Chain }), [node1.url])

    await vi.waitFor(() => {
      expect(hashes(restartedNode2.blockchain)).toEqual(hashes(node1.blockchain))
    })
    expect(restartedNode2.blockchain.chain).toHaveLength(4)
  })

  it('keeps its own chain when the peer it connects to is behind', async () => {
    const node1 = await start(chainWithBlocks(1))
    const node2Chain = chainWithBlocks(3)
    const node2Hashes = hashes(node2Chain)
    const node2 = await start(node2Chain, [node1.url])

    await vi.waitFor(() => {
      expect(console.info).toHaveBeenCalledWith('WebSocket message received: CHAIN_RESPONSE')
    })
    expect(hashes(node2.blockchain)).toEqual(node2Hashes)
  })

  it('requests the full chain when a new block is more than one ahead', async () => {
    const node1 = await start(new Blockchain())
    const node2 = await start(new Blockchain(), [node1.url])

    await vi.waitFor(() => {
      expect(node1.webSocketServer.clients.size).toBe(1)
    })

    node1.blockchain.addBlock([])
    const latest = node1.blockchain.addBlock([])
    node1.webSocketServer.broadcast({ type: 'NEW_BLOCK', block: latest })

    await vi.waitFor(() => {
      expect(hashes(node2.blockchain)).toEqual(hashes(node1.blockchain))
    })
  })
})

describe('createChainSyncHandlers', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('appends the next block', () => {
    const peer = chainWithBlocks(1)
    const blockchain = new Blockchain()
    const requestChain = vi.fn()

    createChainSyncHandlers(blockchain).onNewBlock?.(peer.getLatestBlock(), requestChain)

    expect(hashes(blockchain)).toEqual(hashes(peer))
    expect(requestChain).not.toHaveBeenCalled()
  })

  it('ignores a block it already has without warning', () => {
    const blockchain = chainWithBlocks(2)
    const requestChain = vi.fn()

    createChainSyncHandlers(blockchain).onNewBlock?.(blockchain.getLatestBlock(), requestChain)

    expect(blockchain.chain).toHaveLength(3)
    expect(requestChain).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('warns about an invalid next block without requesting the chain', () => {
    const block = chainWithBlocks(1).getLatestBlock()
    block.previousHash = 'forged'
    const requestChain = vi.fn()

    createChainSyncHandlers(new Blockchain()).onNewBlock?.(block, requestChain)

    expect(requestChain).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith('Rejected invalid incoming block: 1')
  })

  it('replaces its chain with a longer valid one', () => {
    const peer = chainWithBlocks(3)
    const blockchain = new Blockchain()

    createChainSyncHandlers(blockchain).onChain?.(peer.chain)

    expect(hashes(blockchain)).toEqual(hashes(peer))
  })

  it('warns and keeps its chain when a longer one is invalid', () => {
    const peer = chainWithBlocks(3)
    const tampered = peer.chain[2]
    if (!tampered) throw new Error('expected block 2')
    tampered.timestamp = '2000-01-01T00:00:00.000Z'
    const blockchain = new Blockchain()

    createChainSyncHandlers(blockchain).onChain?.(peer.chain)

    expect(blockchain.chain).toHaveLength(1)
    expect(console.warn).toHaveBeenCalledWith('Rejected invalid chain from peer: 4 blocks')
  })

  it('ignores a chain that is not longer without warning', () => {
    const blockchain = chainWithBlocks(2)
    const ourHashes = hashes(blockchain)

    createChainSyncHandlers(blockchain).onChain?.(chainWithBlocks(1).chain)

    expect(hashes(blockchain)).toEqual(ourHashes)
    expect(console.warn).not.toHaveBeenCalled()
  })
})
