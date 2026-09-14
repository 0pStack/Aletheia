# Aletheia
Blockchain-backed access logging for medical records — patient data in SQL, every read and write permanently on-chain.


## Backend setup

From the project root:

```bash
cd backend
npm install
```

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