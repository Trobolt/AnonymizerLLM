---
paths:
  - "frontend/**/*.ts"
  - "frontend/**/*.tsx"
---

# Frontend conventions

Loaded when editing frontend files. Architecture overview lives in the root `CLAUDE.md`.

## API adapter pattern

- `lib/api/factory.ts` is a singleton factory returning either `HttpAdapter` or `IpcAdapter` (both implement `ApiClient` in `lib/api/types.ts`), selected by `NEXT_PUBLIC_API_MODE` (`http` = dev/browser, `ipc` = Electron production via `window.electronApi` from `preload.ts`).
- UI code must call the high-level functions in `lib/api.ts` (`fetchChatList`, `addChat`, `removeChat`, …), never an adapter directly — that's what keeps the transport swappable.

## Gotcha: streaming bypasses the adapter

- `streamChatMessage` in `lib/api.ts` does **not** go through the factory. It `fetch`es a **hardcoded `http://localhost:8000`** because streaming needs the raw response body, so it does not work through the IPC adapter. Keep this in mind when changing ports or building for Electron.
- The stream is NDJSON: parse line by line and dispatch on each event's `type` (`token`, etc.).

## Roles

- Message roles from the backend are `"user"` and `"model"` (not `"assistant"`). Type unions and rendering logic must match.

## Tooling (run inside `frontend/`)

- Test: `npm test` (Vitest, jsdom) · watch: `npm run test:watch`
- Lint: `npm run lint` · Format: `npm run format`