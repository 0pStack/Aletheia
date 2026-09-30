import type { RawData, WebSocket } from 'ws'
import { generateKeyPair, type KeyPair } from '../chain/keypair.js'
import { createTrustedNodeKeys } from '../chain/trusted-node-keys.js'
import { signPeerChallenge, type PeerIdentity } from '../peer-auth.js'

export const testNodeKeys = generateKeyPair()

export const testPeerIdentity: PeerIdentity = {
  keyPair: testNodeKeys,
  trustedKeys: createTrustedNodeKeys([testNodeKeys.publicKey]),
}

function challengeIn(data: RawData): string | undefined {
  const message: unknown = JSON.parse(data.toString())

  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'AUTH_CHALLENGE' &&
    'challenge' in message &&
    typeof message.challenge === 'string'
  ) {
    return message.challenge
  }

  return undefined
}

export async function requestChallenge(socket: WebSocket): Promise<string> {
  const challengeMessage = new Promise<string>((resolve) => {
    const onMessage = (data: RawData): void => {
      const challenge = challengeIn(data)
      if (challenge === undefined) return
      socket.off('message', onMessage)
      resolve(challenge)
    }
    socket.on('message', onMessage)
  })
  socket.send(JSON.stringify({ type: 'AUTH_REQUEST' }))
  return challengeMessage
}

export function authResponse(challenge: string, keyPair: KeyPair = testNodeKeys): string {
  return JSON.stringify({
    type: 'AUTH_RESPONSE',
    publicKey: keyPair.publicKey,
    signature: signPeerChallenge(challenge, keyPair.privateKey),
  })
}

// Messages on one socket are handled in order, so anything sent after this is authenticated.
export async function authenticateAsPeer(
  socket: WebSocket,
  keyPair: KeyPair = testNodeKeys,
): Promise<void> {
  socket.send(authResponse(await requestChallenge(socket), keyPair))
}
