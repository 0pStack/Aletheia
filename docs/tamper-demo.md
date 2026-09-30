# Live tamper demo

How to show, in front of an audience, that nobody can quietly rewrite the access log: not an attacker with disk access, and not the people who run the server.

The automatic version (`npm run demo`) makes the edit for you. This live version stops and lets you make it by hand, so the audience sees that nothing is staged.

## Before you start

- `npm install` and `npm run setup` from the project root have been run on this machine.
- The file `backend/data/demo/chain-3002.json` is ready to open in an editor, for example VS Code in the repo.
- Screen sharing shows the terminal and the editor side by side.

## Run it

From the project root:

```bash
npm run demo:live
```

The demo prints its steps as it goes:

| Step                              | What happens                                                                                                                           | What to say                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. Seed the database              | Fresh demo data                                                                                                                        | "We start from a clean database."                                    |
| 2. Start both nodes               | Nodes 3001 and 3002 start and authenticate each other                                                                                  | "Two independent servers, each with its own copy of the access log." |
| 3. Use the journal                | A doctor, a nurse and a patient read and write records, and one access is refused                                                      | "Every read, write and refusal becomes an event on the chain."       |
| 4. Wait for the nodes to agree    | Both nodes hold the same chain, and both are valid                                                                                     | "Both copies agree."                                                 |
| 5. Tamper with the chain yourself | Node 3002 stops, and the demo prints the file path and the first event, e.g. `Block 1 starts with: userId 21 (DOCTOR) READ patient 13` | See below                                                            |
| 6. Detect it                      | Node 3002 restarts from your edited file and reports `chain INVALID from block 1`                                                      | See below                                                            |

The frontend starts alongside the demo on http://localhost:5173.

### Step 5: the edit

1. Open `backend/data/demo/chain-3002.json`.
2. Find block 1, the one the terminal named, and its first event in `data`.
3. Change `"userId": 21` to another number, e.g. `4`. The story: "The person who read this journal wants it to look like someone else did."
4. **Leave `hash`, `merkleRoot` and `signature` as they are.** That is the realistic attack: the attacker can change the content but cannot produce matching fingerprints.
5. Save the file.
6. Go back to the terminal and press **Enter**.

If you press Enter without saving a change, the demo says node 3002 is still valid, which is the correct answer. Save, then run the demo again.

### Step 6: the result

The terminal shows:

```
node 3001: chain valid
node 3002: chain INVALID from block 1
```

and node 3002 logs `WARNING: the saved chain ... is INVALID. It may have been tampered with.` when it starts.

Show the same result in the browser:

- http://localhost:3001/api/chain/status gives `{"valid": true, "firstInvalidBlockIndex": null}`
- http://localhost:3002/api/chain/status gives `{"valid": false, "firstInvalidBlockIndex": 1}`

For a side-by-side view, open `backend/data/demo/chain-3001.json` next to the edited file. The `userId` differs, while `hash` and `merkleRoot` are identical. The content changed and its fingerprints did not, and that mismatch is what the node detects.

## Why it is caught

On startup, and on every `GET /api/chain/status`, the node checks each block (`findFirstInvalidBlockIndex` in `backend/src/chain/chain-validation.ts`):

1. **Merkle root:** the events are hashed again into a Merkle root (`backend/src/chain/merkle.ts`) and compared to the stored `merkleRoot`. Any change to any event changes the root. This is the check your edit fails.
2. **Block hash:** SHA-256 over index, timestamp, Merkle root, previous hash and nonce (`backend/src/chain/block.ts`) must equal the stored `hash`.
3. **Signatures:** every event is signed with the node's Ed25519 key and must verify against a trusted node key.
4. **Links:** each block's `previousHash` must equal the hash of the block before it.

## Questions you may get

**"Can't the attacker just recalculate the hashes?"**
Recalculating the Merkle root and the hash of block 1 changes that block's `hash`, so block 2's `previousHash` no longer matches. The attacker would have to rehash every later block, and even then check 3 fails: the edited event's signature was made by the node's private key, which the attacker does not have. A key they generate themselves is not in the trusted keys.

**"What if they edit both nodes?"**
They would need to get into every node, forge signatures they cannot make, and do it without anyone noticing that the nodes disagree. With the log on independent machines, one honest node is enough to expose the edit, as node 3001 does here.

**"Why doesn't node 3002 just fix itself from node 3001?"**
A node only replaces its chain with a longer valid one, and it refuses new blocks that build on a broken block. It keeps reporting the problem instead of silently hiding it, which is the behaviour you want from an audit log.

**"Is the patient's medical text on the chain?"**
No. Notes stay in each node's SQL database. The chain only holds who did what to which record, and when (see `docs/interfaces.md`).

## Afterwards

Press Ctrl+C to stop the nodes and the frontend. Run `npm run demo:live` again to start over; it reseeds and clears the demo chains every time. Your normal chains in `backend/data/` are never touched.
