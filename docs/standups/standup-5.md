# Standup 5 (2026-09-26)

## What we're building

Aletheia is a patient journal system where nobody can secretly read a record. Every time someone opens, writes to or is refused access to a journal, it's written into a shared log that can't be edited afterwards. The log is a small blockchain kept on two servers that check each other. A patient can see exactly who has opened their record, and the verification badge shows that each entry is genuine and hasn't been altered.

## How far we've got

GitHub numbers as of today:

|                                                                  | Done     | Left |
|------------------------------------------------------------------|----------|------|
| Planned issues (the original plan, #1–#59)                       | 46 of 53 | 7    |
| All issues, including bugs and improvements found along the way  | 59 of 84 | 25   |

By issue count, about 87% of the plan is done. Weighted by effort, it's closer to 80%. The hardest parts are what's left: keeping the two servers in sync, and making the demo actually work.

What's done:
- Phases 0–2 are finished: login, roles, the three note visibility levels, patient search, the journal, signed events, the chain itself, and connecting the two servers.
- Most of Phase 3 is done: tamper detection, the access log, Merkle proofs, the verify endpoint, and the verification badge (#43, merged in PR #142).
- Syncing after a server has been offline (#37) is built and waiting in PR #145.

## What's left of the plan

| Issue | What                                                        | Owner                                  |
|-------|-------------------------------------------------------------|----------------------------------------|
| #37   | Servers catch up after one has been offline                 | Ruslan. PR #145 is open, nearly done   |
| #38   | Servers agree when both wrote at the same time              | Nobody. Needs #37                      |
| #39   | A new access-log entry reaches the other server's browsers  | Nobody                                 |
| #44   | The access log updates live                                 | Nobody. Needs #39                      |
| #45   | Raise test coverage to target                               | Nobody. #117 sets up the 80% threshold |
| #46   | Seed data and a one-command two-server demo                 | Nobody. Needs #37, ideally #38         |
| #49   | Presentation                                                | Everyone                               |

## Found along the way

The security review of #37 found that a made-up chain can pass validation, because each event's signature is checked against the key inside the event itself. PR #145 stops outside clients from replacing a server's history, and three follow-ups are now in progress:

| Issue | What                                                  |
|-------|-------------------------------------------------------|
| #146  | Check signatures against the known server keys. Needs a group decision on how servers share their public keys |
| #147  | Limit how often a client can ask for the whole chain  |
| #148  | Stop a huge incoming chain from freezing the server   |

Other open bugs worth fixing before the demo: #96 (logging in on the second server fails), #134 (a block is sent to the other server even when saving it failed), #136 (no size limit on WebSocket messages).
