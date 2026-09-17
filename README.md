# Aletheia
Blockchain-backed access logging for medical records — patient data in SQL, every read and write permanently on-chain.


## Backend setup

From the project root:

```bash
cd backend
npm install
npm run dev
```

The server listens on http://localhost:3001 (set `PORT` to change it). `GET /api/health` answers when it is up.

| Script | What it does |
|--------|--------------|
| `npm run dev` | Start with reload on save (`tsx watch`) |
| `npm test` | Run the Vitest tests once (`npm run test:watch` to keep watching) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check without building |
| `npm run format` / `format:check` | Prettier |
| `npm run build` / `npm start` | Compile to `dist/` and run it |

`better-sqlite3` is pinned to 12.11 because version 13 compiles from source on install, which fails on Windows without Visual Studio Build Tools. Don't upgrade it until 13 ships prebuilt install binaries again.

## Frontend setup

React 19 + Vite + TypeScript. Requires Node 20.19+ or 22.12+.

```bash
cd frontend
npm install
npm run dev
```

No `.env` is needed to start: in development the API is mocked by default. Copy `.env.example` to `.env` only to change the settings below.

The dev server runs on http://localhost:5173 and proxies `/api` and `/ws` to `VITE_API_TARGET` (default `http://localhost:3001`), so the session cookie works without CORS.

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_USE_MOCKS` | `true` in dev | Set to `false` to call the real backend instead of the MSW mocks in `src/mocks/` |
| `VITE_API_TARGET` | `http://localhost:3001` | Backend node to proxy to (3001 or 3002) |

### Mock logins

With mocks on, these fake users exist (password `hunter2` for all). Shapes and access rules follow [docs/interfaces.md](docs/interfaces.md).

| Username | Role | Can do |
|----------|------|--------|
| `dr.berg` | `DOCTOR` | Search, view any patient, access logs |
| `n.svensson` | `NURSE` | Same as doctor |
| `clinic.vasa` | `CLINIC` | Same as doctor |
| `a.lindqvist` | `PATIENT` | Only own record (patient 101) and its access log, `ALL` notes only |
| `k.holm` | `UNAUTHORIZED` | Nothing, every patient route returns 403 |

## Test Accounts (Seed Data)

All seeded test accounts use the password: `Password123!`

| Username | Role | Linked Patient | Purpose / Access |
| :--- | :--- | :--- | :--- |
| `doctor_dr_house` | `DOCTOR` | None | Reads/writes notes, sees `ALL`, `STAFF`, and own `PRIVATE` notes |
| `nurse_jackie` | `NURSE` | None | Reads/writes notes, sees `ALL`, `STAFF` notes |
| `clinic_admin` | `CLINIC` | None | Administrative overview / access |
| `patient_anna` | `PATIENT` | Anna Andersson | Reads only `ALL` visibility notes for own record |
| `unauth_user` | `UNAUTHORIZED` | None | Blocked / unverified account testing |

Run the seed script from the `backend/` directory:
```bash
npm run db:seed
```

Checks that must pass before a PR:

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

`npm run format` applies Prettier. Structure:

```
src/
  api/        http client, response envelope, zod schemas, query keys
  app/        router, auth guard, layout, app-level pages
  features/   auth, patients, journal, access-log
  mocks/      MSW handlers for dev and tests
  styles/     design tokens, reset, global styles
  test/       Vitest setup
```

## Credits

Login hero image: [Swirling abstract pattern of green and orange gradients](https://unsplash.com/photos/i-BP0cmbfRo) by [Logan Voss](https://unsplash.com/@loganvoss), used under the [Unsplash License](https://unsplash.com/license).