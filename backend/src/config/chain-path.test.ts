import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveChainPath } from './chain-path.js'

describe('resolveChainPath', () => {
  it('keeps the chain in ./data by default', () => {
    expect(resolveChainPath({}, 3001)).toBe(join('data', 'chain-3001.json'))
  })

  it('uses CHAIN_DIR when it is set', () => {
    expect(resolveChainPath({ CHAIN_DIR: 'data/demo' }, 3002)).toBe(
      join('data', 'demo', 'chain-3002.json'),
    )
  })

  it('ignores a blank CHAIN_DIR', () => {
    expect(resolveChainPath({ CHAIN_DIR: '  ' }, 3001)).toBe(join('data', 'chain-3001.json'))
  })
})
