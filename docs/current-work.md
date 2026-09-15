# Current work

What to work on, in what order, and what "done" looks like for each issue.
Last checked against `main` on 2026-09-15 (commit `ecd6849`).

## How to pick an issue

1. Stay in the **current phase**. Don't start a later phase while the current one has open issues nobody is working on.
2. Choose an issue that is **unassigned** and whose **Needs** issues are all merged.
3. Assign yourself, move the card to **In progress**, and say so in Teams.
4. Pull `main` first (`git pull`), then commit and push to `main`. Put `Closes #<nr>` in the commit message so GitHub closes the issue by itself.
5. Take the next issue only after the last one is pushed.

Inside a phase, the issues are split into **lanes** (chain, backend, p2p, frontend). Lanes don't wait on each other unless an issue lists a Need, so four people can work at the same time, one per lane.

## Where we are

This table matches the project board, [@Web3 - Alenthia Journal](https://github.com/users/0pStack/projects/2).

| Board status | Issues |
|--------------|--------|
| Done | #1 backend folder and dependencies, #47 README, #48 group contract |
| In Progress | #3 shapes (Anders) · partly done on `main`: #6 mock API, #7 lint and scripts (frontend only), #16 login page (visual only), #33 access denied page (static only) |
| Todo | Everything else |

**None of the open issues is finished yet.** The frontend scaffold (PR #53) gave a head start on #6, #7, #16 and #33, but each still has work left, which is listed under the issue below. `backend/` has only a `package.json` so far and no source code.

---

## Phase 0: Contracts and skeleton (now)

Almost everything else depends on this phase, so it comes first. Most of it is agreeing on things and writing them down, so it goes quickly when done together.

### #3 Agree AccessEvent, Block and API envelope shapes
**Status:** in progress (Anders). **Blocks:** almost everything.
- Create `docs/interfaces.md`.
- **API envelope:** the frontend uses a placeholder `{ success, data, error }` in `frontend/src/api/envelope.ts`. Keep it or change it. If it changes, only that one file needs editing.
- **AccessEvent:** list the fields, for example event id, user id, role, patient id (or its hash), action (`read` / `write` / `denied`), timestamp, node id and signature (signature arrives in #20).
- **Block:** `index, timestamp, data, previousHash, hash, nonce` (from #8), plus `merkleRoot` (from #22).
- **Endpoint list:** method, path, request and response for login, logout, session, patient search, patient + notes, create note, access log and verify. The frontend already calls `GET /api/auth/session`.
- **Roles and the three note visibility levels:** name them here. #23, #24 and #31 all depend on them, and they aren't defined anywhere yet.
- Done when every track has approved the PR.

### #4 Define on-chain field whitelist (no patient data)
**Needs:** #3 (can go in the same PR). **Blocks:** #13, #27.
- In `docs/interfaces.md`, list exactly which AccessEvent fields may go on the chain: IDs, hashes, action, role, timestamp.
- List what is forbidden: names, personnummer, note text, anything else from the journal.

### #5 Draft SQL schema: users, roles, patients, notes, sessions
**Blocks:** #10.
- The backend uses `better-sqlite3`, so write the schema for SQLite.
- Tables: `users` (username, password hash, role), `patients`, `notes` (author, patient, text, **visibility**, created at), and sessions (or use a session store).
- Commit an ER sketch and the `CREATE TABLE` statements (for example `backend/db/schema.sql`), then review them together.

### #6 Mock API layer matching the agreed envelope
**Needs:** #3 for the real paths (you can start with assumed ones). **Blocks:** testing #16, #17, #18 without a backend.
- **Already done (PR #53):** MSW is set up in `frontend/src/mocks/`, the envelope parser exists, and mocks are on by default in dev.
- **Left:** only `GET /api/auth/session` is mocked. Add handlers with fake data for login, logout, patient search, patient + notes, and access log, including 401 and 403 responses.

### #7 Add npm scripts, ESLint and Prettier config
**Blocks:** every backend, chain and p2p issue, because they need a test runner.
- **Already done:** the frontend has `dev`, `build`, `test`, `lint`, `format` and `typecheck`.
- **Left in `backend/`:** `tsconfig.json`, a `src/` folder, `dev` (`tsx watch`), `test` (for example Vitest, to match the frontend), `lint`, and ESLint + Prettier config. The `test` script is still the npm placeholder.
- Decide where chain and p2p code lives, for example `backend/src/chain/` and `backend/src/network/`.
- Watch out: the backend uses TypeScript 7, and typescript-eslint doesn't support it yet. That's why the frontend pins TypeScript ~6.0.

---

## Phase 1: One node, one logged read

**Goal:** log in, open a patient, and see that read become a block on the chain.

| Lane | Order |
|------|-------|
| Chain | #8 → #9 |
| Backend | #10 → #11 → #12, #55 → #13 (#13 also needs #9 and #4) |
| P2P | #14 → #15 |
| Frontend | #16, #17, #18 (build against mocks, switch to the real API when it exists) |

### #8 Block class with sha256 hashing
- A `Block` with `index, timestamp, data, previousHash, hash, nonce`.
- `calculateHash()` uses `node:crypto` sha256 over all fields, with `data` as JSON.
- Tests: the same input gives the same hash, and changing any field changes the hash.

### #9 Blockchain class: genesis, addBlock, isChainValid
**Needs:** #8.
- A genesis block, `getLatestBlock()`, and `addBlock(data)`, which sets `previousHash`.
- `isChainValid()` recomputes every hash and checks every `previousHash` link.
- Pure logic, with no Express and no database.
- Tests: a valid chain passes, and changing the data in one block makes it invalid.

### #10 Create schema and seed data
**Needs:** #5.
- Apply `schema.sql` to a local SQLite file, and add that file to `.gitignore`.
- Add a seed script (`npm run db:seed`) that creates at least one user per role, a few patients, and notes at every visibility level.
- Hash passwords. `node:crypto` `scrypt` works without an extra dependency.
- Put the test logins in the README so everyone can sign in.

### #11 Session-based login
**Needs:** #10, #7.
- `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/session`.
- The session response must match `frontend/src/api/schemas.ts` (`id, name, role`) or whatever #3 agrees on.
- Use an `express-session` cookie with `httpOnly` and `sameSite`. Compare passwords with `timingSafeEqual`.
- The Vite dev server proxies `/api` to port 3001, so no CORS setup is needed.

### #12 GET /patients/:id route
**Needs:** #10, #11.
- Requires a session. Returns the patient and their notes in the envelope, or 404 if the patient doesn't exist.
- Add integration tests (for example with `supertest`).

### #55 GET /patients search route
**Needs:** #10, #11. **Blocks:** #17 with real data.
- `GET /api/patients?q=` searches by name or ID. Requires a session, and returns a list in the envelope.
- Search inside the SQL query, not by loading every patient and filtering in JavaScript.

### #13 auditLogger middleware writing events to the chain
**Needs:** #9, #4, #12.
- Express middleware on the patient and journal routes. After each read or write, build an AccessEvent containing **only whitelisted fields** and add it to the chain.
- One block per event is fine for now. Batching comes with #22.
- Test: `GET /patients/1` makes the chain one block longer, and that block contains only whitelisted keys.

### #14 Node bootstrap and port config for 3001/3002
**Needs:** #7.
- One entry file reads `PORT` and `PEERS` from env. Add a `.env.example`.
- Add scripts `dev:node1` (port 3001) and `dev:node2` (port 3002).
- The frontend proxies both `/api` and `/ws` to the same port, so put the WebSocket server on the same HTTP server.

### #15 WebSocket server skeleton
**Needs:** #14.
- Attach a `ws` server to the HTTP server. Log connects and disconnects.
- Parse each message as JSON with a `type` field inside try/catch, so a bad message can't crash the node.
- Agree the message types (for example `NEW_BLOCK`, `CHAIN_REQUEST`, `CHAIN_RESPONSE`). No broadcasting yet.

### #16 Login page
**Needs:** #6 (a login mock), then #11 for the real backend.
- **Already done (PR #53):** the page design, the fields, password reveal, and the Caps Lock hint.
- **Left:** submitting does nothing yet. Validate empty fields, call login through `src/api/http.ts` as a React Query mutation, and show a "wrong username or password" error and a network error. Disable the button while the request is running. On success, refresh the session query and redirect to `/patients`.
- Add tests to `LoginPage.test.tsx`.

### #17 Patient search
**Needs:** #6 (a search mock), then #55.
- Replace the placeholder in `PatientSearchPage.tsx`: a search input, a results list linking to `/patients/:id`, and loading, empty and error states.

### #18 Basic journal view
**Needs:** #6 (a patient mock), then #12.
- `JournalPage.tsx` reads `:patientId`, fetches the patient and notes, and shows them. Handle the 404 case.
- Add zod schemas for the patient and notes in `src/api/schemas.ts`. No role logic yet.

---

## Phase 2: Identity and integrity

**Goal:** roles are enforced, events are signed, and two nodes are connected.

| Lane | Order |
|------|-------|
| Chain | #19 → #20 → #21, and #22 and #57 (need only #9) |
| Backend | #23 → #24, #25 · #26 (needs #13 + #20) · #27 (needs #4 + #13) |
| All | #58 CI (needs #7) · #59 group decision about notes on both nodes (settle before Phase 3) |
| P2P | #28 → #29 → #30 (needs #9, #15) |
| Frontend | #31 (needs #23, #24) · #32 (needs #24) · #33 (needs #25) |

### #19 Keypair generation (public/private)
- Use `node:crypto` `generateKeyPairSync` (ed25519 is simplest). Decide whether keys are per node or per user. Per node is easier.
- Generate a keypair on first start if none exists, and store it in a folder listed in `.gitignore`. Never commit private keys.

### #20 Sign access events
**Needs:** #19.
- Sign the AccessEvent with the private key and attach the signature and the signer's public key or id.
- Serialize the event with a **stable key order** before signing. Otherwise the same event can serialize differently and fail verification.

### #21 Verify signatures
**Needs:** #20.
- Add `verify(event)`. `addBlock` and `isChainValid` reject any block containing an event whose signature fails.
- Tests: an altered event field is rejected, and a forged signature is rejected.

### #22 Merkle tree and root in the block header
**Needs:** #9.
- Build a Merkle tree from sha256 hashes of the events (if a level has an odd count, duplicate the last hash). Store `merkleRoot` on the block and include it in the block hash.
- Batch events into blocks, for example every N events or every few seconds.
- `isChainValid` also recomputes the root.

### #57 Persist the chain across restarts
**Needs:** #9. **Blocks:** #37, #41, #46.
- Save blocks to disk (a JSON file or a SQLite table) as they're added. On startup, load them and run `isChainValid` before the node accepts any requests.

### #23 Role-based access control
**Needs:** #11, and the roles from #3.
- A `requireRole(...)` middleware on **every** route, enforced on the server.
- Return 401 when not signed in and 403 for the wrong role. Add tests for each role.

### #24 Three note visibility levels
**Needs:** #23.
- `POST /api/patients/:id/notes` with a visibility level.
- Filter by visibility **in the SQL query**, so hidden notes never leave the server.
- Test what each role can see.

### #25 Access denied enforcement
**Needs:** #23, #13.
- A refused read returns 403 in the envelope, **and** the auditLogger still writes a `denied` event.
- Test: a denied read returns 403 and adds a `denied` event to the chain.

### #26 Wire event signing into auditLogger
**Needs:** #13, #20.
- The auditLogger signs every event before it's batched or added.
- Test: every event on the chain has a valid signature.

### #27 Test asserting no patient data reaches the chain
**Needs:** #4, #13.
- After running some seeded requests, go through every block and fail if any key isn't on the whitelist. Also check that no seeded name or personnummer appears in any value.
- This test must run in CI, which comes with #58.

### #58 CI workflow running lint and tests
**Needs:** #7.
- Add a GitHub Actions workflow in `.github/workflows/` that runs `npm ci`, lint and tests for `backend/` and `frontend/` on every push to `main`.
- Since everyone pushes straight to `main`, CI is the only automatic check on each push.

### #59 Decide how notes reach the other node
**Group decision. Settle before #39 and #44.**
- If each node has its own SQLite database, a note written on node 1 never reaches node 2's database.
- Options: both nodes share one database, or notes are copied over the P2P connection along with blocks. Write the decision in `docs/interfaces.md`.

### #28 Connect node 3001 to node 3002
**Needs:** #15.
- On start, each node connects to every URL in `PEERS`, keeps a list of open sockets, and reconnects with a delay when a connection drops.

### #29 Broadcast new blocks to peers
**Needs:** #28, #9.
- After `addBlock`, send `{ type: 'NEW_BLOCK', block }` to every peer.

### #30 Receive and validate incoming blocks
**Needs:** #29, and #21 for signature checks.
- Check that `index` is one more than ours, `previousHash` matches our latest hash, the hash recalculates correctly, and the signatures are valid. Only then append the block.
- An invalid block is logged and ignored and never crashes the node. If the incoming block is several blocks ahead of ours, ask the peer for its full chain instead (that's #37).

### #31 Role-dependent journal view
**Needs:** #18, #23, #24.
- Show what the server sends, and hide actions the role can't perform (for example writing a note).
- Don't filter hidden notes in the browser. The server must never send them.

### #32 Note form with the three visibility levels
**Needs:** #24.
- On the journal page: a text field, radio buttons for the three levels, and a submit button. After saving, refresh the journal. Handle validation and error states. Show the form only to roles allowed to write.

### #33 Access denied page
**Needs:** #25.
- **Already done:** a static page at `/access-denied`.
- **Left:** show it when the API returns 403 (handle it in `src/api/http.ts` or the query error handling). Add a test with a 403 mock.

---

## Phase 3: Distribution and trust

**Goal:** the nodes stay in sync, tampering is detected, and entries can be proven.

| Lane | Order |
|------|-------|
| Chain | #35 → #34 · #36 (needs #22) |
| P2P | #37, #38 (need #34, #28, #57) · #39 (needs #28, #24, #59) |
| Backend | #40 (needs #36) · #41 (needs #57) · #56 (needs #13, #23) |
| Frontend | #42 (needs #56) · #43 (needs #40) · #44 (needs #39) |

### #35 Validate incoming chains
- Check a received chain from start to finish: its genesis block matches ours, and every link, hash, Merkle root and signature is valid.

### #34 Longest chain rule
**Needs:** #35.
- `replaceChain(incoming)` replaces our chain only when the incoming one is longer **and** valid. Test both the accept and the reject case.

### #36 Merkle proof of inclusion
**Needs:** #22.
- `getProof(eventHash)` returns the sibling hashes along with their left or right position. `verifyProof(leaf, proof, root)` checks the proof.
- Test with an odd number of events.

### #37 Sync chain on reconnect
**Needs:** #34, #28, #57.
- When nodes connect, they compare chains. If the peer has a longer chain, ask for it and run `replaceChain`.
- Test: stop node 2, add blocks on node 1, start node 2, and both nodes end up with the same chain.

### #38 Fork resolution
**Needs:** #34, #37.
- Create a fork on purpose: disconnect the nodes, add blocks on both, then reconnect. Both must end up on the longest valid chain.
- Decide what happens to events on the losing branch (add them again or accept they're lost) and document the choice.

### #39 Socket push for the live note list
**Needs:** #28, #24, #59.
- When a note is created, push an event over `/ws` to connected browsers, including browsers connected to the other node.
- How the note itself reaches the other node is decided in #59.

### #40 Verification endpoint
**Needs:** #36.
- `GET /api/verify/:eventId` returns the block index, Merkle root, proof, and whether it's valid. Only hashes, no patient data.

### #41 Tamper detection
**Needs:** #57.
- `GET /api/chain/status` returns `valid` and the index of the first bad block. Also check on startup and log a warning if the chain is invalid.
- For the demo, edit a block in the saved chain from #57 and show that the status reports it.

### #56 GET /patients/:id/access-log route
**Needs:** #13, #23.
- Return who read or wrote this patient's journal, and when, built from the AccessEvents on the chain. Only allowed roles can call it.
- Add user names from SQL on the server. Names are never stored on the chain.

### #42 Access log view
**Needs:** #56.
- The page placeholder already exists at `/patients/:id/access-log`. Show a table of who, which role, which action, and when.
- The server adds user names from SQL. Names are never stored on the chain.

### #43 Verification badge
**Needs:** #40, #42.
- For each entry, call #40 and show Verified, Pending or Failed as text, not only as a color.

### #44 Live-updating note list
**Needs:** #39.
- Listen on `/ws`. When a note arrives, refresh the journal query. Handle reconnecting.

---

## Phase 4: Hardening and demo

### #45 Raise test coverage to target
- Agree on the target, since the contract doesn't set one. Turn on `vitest --coverage` in both the frontend and the backend. Unit-test the chain logic and integration-test the routes.

### #46 Seed data and two-node demo script
**Needs:** most of Phase 3, including #57.
- One command (for example `npm run demo`) seeds the database, starts nodes 3001 and 3002, makes some reads, then tampers with a block so #41 detects it.

### #49 Presentation preparation
- Slides and a rehearsed demo. A suggested flow: log in → search → open journal → access log → verification badge → start node 2 and watch it sync → tamper → detected.
