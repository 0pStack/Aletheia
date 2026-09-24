import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { Block, type BlockData } from './block.js'

export function saveChain(filePath: string, chain: Block[]): void {
  mkdirSync(dirname(filePath), { recursive: true })

  const tempPath = `${filePath}.tmp`
  writeFileSync(tempPath, JSON.stringify(chain, null, 2))
  renameSync(tempPath, filePath)
}

export function loadChain(filePath: string): Block[] | undefined {
  if (!existsSync(filePath)) {
    return undefined
  }

  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'))

  if (!Array.isArray(parsed)) {
    throw new Error(`Saved chain in ${filePath} is not an array`)
  }

  return (parsed as BlockData[]).map((json) => Block.fromJSON(json))
}
