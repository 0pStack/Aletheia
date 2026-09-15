# On-chain Field Whitelist

This document defines which fields are allowed to be stored on the Aletheia blockchain.

The blockchain is used only for audit logging. Medical journal content must remain in the SQL database and must never be stored on-chain.

## Allowed on-chain fields

The following fields are allowed in an audit block:

* `patientId` — internal patient identifier
* `userId` — internal user identifier
* `action` — type of action performed, for example `VIEW_RECORD` or `CREATE_NOTE`
* `timestamp` — time when the action occurred
* `serverId` — identifier of the server that created the audit event

The block itself may also contain technical blockchain fields:

* `index`
* `previousHash`
* `hash`
* `nonce`

## Data that must never be stored on-chain

The following data must remain in the SQL database:

* Patient name
* Personal identity number / personnummer
* Medical journal text
* Medical diagnoses
* Medications
* Treatment information
* Notes or other free-text medical information
* Other personally identifiable or sensitive medical information

## Example of an allowed audit event

```json
{
  "patientId": 123,
  "userId": 45,
  "action": "VIEW_RECORD",
  "timestamp": "2026-09-15T18:30:00.000Z",
  "serverId": "server-1"
}
```

The actual medical journal content is not included in the blockchain event.

## Principle

Only the minimum information required to prove that an access event occurred should be stored on-chain.

Medical data stays in SQL. The blockchain stores the audit information needed to verify access history and its integrity.
