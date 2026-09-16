# Interfaces and System Contracts

This document defines the core data contracts, roles, interfaces, API endpoints, and blockchain models for the Aletheia Journal project.

---

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

---

# Roles and Note Visibility

### System Roles (`UserRole`)

| Role | Key | Permissions & Access |
| :--- | :--- | :--- |
| **Läkare** | `DOCTOR` | Search patients, view full record + staff notes, write all notes, view access logs |
| **Sjuksköterska / Ambulans** | `NURSE` | Search patients, view full record + staff notes, write all notes, view access logs |
| **Vårdcentral** | `CLINIC` | Search patients, view full record + staff notes, write all notes, view access logs |
| **Patient** | `PATIENT` | Direct access to own record and `ALL`-visibility notes only, view access logs. Cannot search |
| **Obehörig** | `UNAUTHORIZED` | Zero system access. Immediate 403 Forbidden / Access Denied |

### Note Visibility Levels (`NoteVisibility`)

When creating medical notes (`POST /api/patients/:id/notes`), the author chooses one of the following:

* `PRIVATE` — Only visible to the author who created the note.
* `STAFF` — Visible to all healthcare staff (`DOCTOR`, `NURSE`, `CLINIC`).
* `ALL` — Visible to healthcare staff and the patient themselves.

---

# Data Structures & Models

### 1. API Envelope (`frontend/src/api/envelope.ts`)

Every HTTP API response must strictly follow the standard response envelope:

```typescript
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  error: null;
}

interface ApiErrorResponse {
  success: false;
  data: null;
  error: {
    code: string;     
    message: string;  
  };
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
```

### 2. AccessEvent (Audit Event on Chain)

Defines individual audit log events. Complies with the field whitelist:

```typescript
interface AccessEvent {
  id: string;                              
  patientId: number;                                  
  userId: number;                                
  role: 'DOCTOR' | 'NURSE' | 'CLINIC' | 'PATIENT' | 'UNAUTHORIZED';
  action: 'READ' | 'WRITE' | 'DENIED';
  timestamp: string;                                   
  serverId: string;                               
  signature?: string;                                  
  publicKey?: string;                                  
}
```

### 3. Block Structure

Defines the structure of each block in the chain:

```typescript
interface Block {
  index: number;
  timestamp: string;                                  
  data: AccessEvent[];                                 
  previousHash: string;                                
  hash: string;                                        
  nonce: number;
  merkleRoot?: string;                                
}
```

---

# API Endpoints Specification

All endpoints return HTTP status code matching the envelope state (200/201 on success, 400/401/403/404/500 on failure).

### Authentication & Session

#### 1. `POST /api/auth/login`
* **Access:** Public
* **Request Body:**
  ```json
  {
    "username": "dr_smith",
    "password": "secretpassword"
  }
  ```
* **Success Response (`data`):**
  ```json
  {
    "user": {
      "id": 1,
      "username": "dr_smith",
      "name": "Dr. Sven Svensson",
      "role": "DOCTOR",
      "patientId": null
    }
  }
  ```
* **Error Response:** 401 Unauthorized (`"code": "INVALID_CREDENTIALS"`).

#### 2. `POST /api/auth/logout`
* **Access:** Authenticated user
* **Request Body:** None
* **Success Response (`data`):**
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

#### 3. `GET /api/auth/session`
* **Access:** Authenticated user
* **Success Response (`data`):** Returns the current user profile (same shape as login `user`).
* **Error Response:** 401 Unauthorized if no active session cookie.

---

### Patient & Medical Records (SQL Database)

#### 4. `GET /api/patients?q={query}`
* **Access:** `DOCTOR`, `NURSE`, `CLINIC`
* **Query Params:** `q` (Search query by name or personal identification number)
* **Success Response (`data`):**
  ```json
  [
    {
      "id": 101,
      "name": "Anna Andersson",
      "personalNumber": "19850101-1234"
    }
  ]
  ```
* **Error Response:** 403 Forbidden for `PATIENT` or `UNAUTHORIZED`.

#### 5. `GET /api/patients/:id`
* **Access:** `DOCTOR`, `NURSE`, `CLINIC`, or `PATIENT` matching `:id`
* **Behavior:** Produces an `AccessEvent` written to the blockchain.
* **Success Response (`data`):**
  ```json
  {
    "patient": {
      "id": 101,
      "name": "Anna Andersson",
      "personalNumber": "19850101-1234"
    },
    "notes": [
      {
        "id": 1,
        "authorId": 5,
        "authorName": "Dr. Sven Svensson",
        "authorRole": "DOCTOR",
        "text": "Patient uppvisar lindriga symptom.",
        "visibility": "ALL",
        "createdAt": "2026-09-15T10:00:00.000Z"
      }
    ]
  }
  ```
* *Filtering Rule:* Notes are filtered in SQLite based on caller role before returning. A `PATIENT` only receives notes with visibility `ALL`.

#### 6. `POST /api/patients/:id/notes`
* **Access:** `DOCTOR`, `NURSE`, `CLINIC`
* **Behavior:** Saves the note in SQL and emits an `AccessEvent` (`action: "WRITE"`) to the blockchain.
* **Request Body:**
  ```json
  {
    "text": "Ordinerat vila och vätskeersättning.",
    "visibility": "ALL"
  }
  ```
* **Success Response (`data`):** Returns the newly created note object.

---

### Audit & Blockchain Verification

#### 7. `GET /api/patients/:id/access-log`
* **Access:** `DOCTOR`, `NURSE`, `CLINIC`, or `PATIENT` matching `:id`
* **Behavior:** Reads audit events from the blockchain for this `patientId`. Joins user names from SQL.
* **Success Response (`data`):**
  ```json
  [
    {
      "eventId": "b3e6c0f3-8f0a-4b68-9a3f-a3d8a1c92a91",
      "userId": 5,
      "userName": "Dr. Sven Svensson",
      "role": "DOCTOR",
      "action": "READ",
      "timestamp": "2026-09-15T10:00:00.000Z",
      "serverId": "server-1",
      "blockIndex": 12
    }
  ]
  ```

#### 8. `GET /api/verify/:eventId`
* **Access:** Authenticated user
* **Behavior:** Returns cryptographic proof (Merkle proof) validating that the event exists unchanged on the blockchain.
* **Success Response (`data`):**
  ```json
  {
    "eventId": "b3e6c0f3-8f0a-4b68-9a3f-a3d8a1c92a91",
    "blockIndex": 12,
    "blockHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "merkleRoot": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
    "proof": [],
    "isValid": true
  }
  ```