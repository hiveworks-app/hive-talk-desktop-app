# Repository Guidelines

## Project Structure & Module Organization

- `src/app/`: Next.js App Router. Route groups: `(auth)` for login/signup, `(main)` for authenticated pages.
- `src/features/`: Business feature modules (FSD pattern). Each feature has `api.ts`, `queries.ts`, `type.ts`.
- `src/widgets/`: Composite UI components (ChatInput, MessageBubble, AppNav, SidePanel, etc.).
- `src/shared/`: Cross-cutting modules (api client, websocket, types, ui primitives, utils, hooks, config).
- `src/store/`: Zustand stores (auth, chatRoom, chatRoomRuntime, uploadProgress, ui, theme).
- `electron/`: Electron main process (`main.ts`), preload bridge (`preload.ts`).
- `public/`: Static assets.
- `resources/`: Electron app icons (icns, ico, png).

## Build, Test, and Development Commands

- `npm run dev`: Start Next.js dev server on port 23000.
- `npm run build`: Production Next.js build (standalone output).
- `npm run electron:dev`: Run Electron + Next.js concurrently for development.
- `npm run electron:compile`: Compile `electron/` TypeScript to `dist-electron/`.
- `npm run electron:build`: Full production build (Next.js build → TS compile → electron-builder).
- `npm run electron:pack`: Build without creating installer (for testing).
- `npm run lint`: Run ESLint.

## Coding Style & Naming Conventions

- Use TypeScript and React function components with `"use client"` directive where needed.
- Path alias: `@/*` maps to `src/*`.
- Follow Feature-Sliced Design: `features/` for business logic, `shared/` for cross-cutting concerns, `widgets/` for composite UI.
- Each feature module separates concerns: `api.ts` (HTTP calls), `queries.ts` (TanStack Query hooks), `type.ts` (TypeScript types).
- Prefer explicit types; avoid `any` and unsafe casting.
- Tailwind CSS for styling via `className`. Use `clsx` + `tailwind-merge` (via `cn()` helper) for dynamic classes.

## State Management

- **Server state:** TanStack Query. Query keys defined in `src/shared/config/queryKeys.ts`.
- **Client state:** Zustand with `persist` middleware for auth (localStorage).
- **Real-time:** WebSocket messages update React Query cache via `queryClient.setQueryData()`.

## Authentication Flow

- Login stores tokens in Zustand (persisted to localStorage) + sets `has-auth` cookie.
- Next.js middleware checks `has-auth` cookie for route protection.
- Token refresh reads `deviceInfo` from auth store (consistent deviceId with login).
- API client (`shared/api/index.ts`) auto-retries on 401 with refreshed token.

## Electron Architecture

- Production: `utilityProcess.fork()` runs Next.js standalone server inside Electron.
- Port 23000 preferred (matches API server CORS config), random port fallback.
- CORS bypass via `webRequest.onHeadersReceived` with URL filter (API domain only).
- IPC bridge exposes: notification, app version, badge count, isElectron flag.
- Single instance lock prevents duplicate app launches.

## Commit & Pull Request Guidelines

- Commit message tags: `[feat]:`, `[fix]:`, `[hotFix]:`, `[refactor]:`
- Branch naming: `feat/...`, `fix/...`, `hotfix/...`
- PRs should include change summary and screenshots for UI changes.

## Testing Guidelines

- No dedicated test script currently configured.
- Run `npm run lint` before committing.
- If adding tests, use `__tests__/` or `*.test.ts(x)` naming convention.
