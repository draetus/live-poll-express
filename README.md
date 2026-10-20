# live-poll-express

Real-time polling app — Express 5 + raw WebSocket (`ws`) + React. Rooms implemented by hand, shared TypeScript contracts.

> 🚧 Work in progress. Full documentation (architecture, decisions, protocol) is coming.

## Project structure

```
api/      Express 5 API (deployed to Render)
web/      React + Vite client (deployed to Vercel)
shared/   TypeScript contracts used by both sides — types and constants only, no dependencies
```

## Running locally

Requires **Node.js 24** (see `.nvmrc`).

```bash
npm run install:all     # installs root (Biome), api/ and web/

npm run dev --prefix api   # API on http://localhost:3000
npm run dev --prefix web   # web on http://localhost:5173
```

Optional: copy `api/.env.example` to `api/.env` and `web/.env.example` to `web/.env.local` to override the defaults.

## Checks

```bash
npm run lint                                    # Biome (lint + format) for the whole repo
npm run typecheck --prefix api && npm test --prefix api
npm run typecheck --prefix web && npm test --prefix web
```

A production build of `web/` requires `VITE_API_URL` and `VITE_WS_URL` to be set.
