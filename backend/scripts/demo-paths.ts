import { join } from 'node:path'

// The demo keeps its chains here, so it never touches the ones in ./data.
export const CHAIN_DIR = 'data/demo'

// `npm run demo:tamper` drops the request; the running demo removes it on pickup and
// answers with the result file: `ok`, or the error that stopped the tamper.
export const TAMPER_REQUEST = join(CHAIN_DIR, 'tamper.request')
export const TAMPER_RESULT = join(CHAIN_DIR, 'tamper.result')
export const TAMPER_OK = 'ok'
