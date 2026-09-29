import { join } from 'node:path'

// CHAIN_DIR lets the demo keep its chains apart from the ones a developer has built up
// in ./data, so running it never wipes someone's local history.
export function resolveChainPath(env: NodeJS.ProcessEnv, port: number): string {
  const dir = env.CHAIN_DIR?.trim() || 'data'
  return join(dir, `chain-${port}.json`)
}
