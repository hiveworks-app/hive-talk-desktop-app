# Gap Detector Memory

## Project: hiveworks-web
- **Stack**: Next.js 16 + TypeScript + Tailwind v4 + Zustand + React Query + WebSocket
- **Architecture**: FSD (Feature-Sliced Design) with layers: app/ -> widgets/ -> features/ -> shared/ -> store/
- **Design doc**: `/Users/jjs/Desktop/dawin/docs/02-design/features/hiveworks-web.design.md`
- **Analysis output**: `/Users/jjs/Desktop/dawin/docs/03-analysis/hiveworks-web.analysis.md`

## Key Findings (2026-02-24, Match Rate: 91%, Act-2 Re-check -- PASSED 90% threshold)
- Both `(main)` and `(auth)` route groups NOW EXIST
- `shared/ui/` has 6 components: Button, Input, ProfileCircle, Badge, ChatImageGrid, MediaViewer
- WS reconnect NOW uses exponential backoff (1s->2s->4s->...->30s, max 10 retries)
- NEXT_PUBLIC_APP_ENV now defined in `shared/config/constants.ts`
- Routes use `/chat` (singular) not `/chats` (plural) -- intentional deviation
- GM/EM lists are tabs in sidebar, not separate routes -- intentional deviation
- react-virtuoso installed but NOT used for MessageList (backlog)
- Radix UI packages installed but NOT used for dialogs (backlog)
- FSD violation remains: `shared/websocket/WebSocketContext.tsx` imports from `features/chat-room-list/`

## Act-2 Fixes Verified
- `shared/ui/Button.tsx` (48 lines, 4 variants, forwardRef) -- used in login page
- `shared/ui/Input.tsx` (24 lines, error prop, forwardRef) -- used in login page
- `shared/ui/ProfileCircle.tsx` (29 lines, 3 sizes) -- used in MessageBubble + ChatRoomListSidebar
- `shared/ui/Badge.tsx` (22 lines, count/max) -- used in ChatRoomListSidebar
- WS backoff at WebSocketContext.tsx:419-433, reset at line 121
- `app/(auth)/login/page.tsx` and `app/(auth)/signup/page.tsx` (old flat routes removed)
- `APP_ENV` + `IS_PRODUCTION` at constants.ts:2-3

## Score History
- v0.1: 78% (initial)
- v0.2: 85% (Act-1: route groups, widget extraction)
- v0.3: 91% (Act-2: shared/ui, WS backoff, auth route, env var) -- PASSED

## False Positive Corrected (v0.1)
- `has-auth` cookie IS correctly set on login at `features/auth/queries.ts:28`
- `has-auth` cookie IS correctly cleared on logout at `store/auth/authStore.ts:60`
- Always verify actual code before flagging

## Remaining Backlog (not blocking 90%)
- Integrate react-virtuoso for MessageList
- Migrate custom modals to Radix Dialog
- Fix FSD violation in WebSocketContext (move updater to shared/)
- features/organization/ (P2), features/dm-check/ (P2)
- Extract shared/ui/ListChat component
- Signup page still uses inline elements (not Button/Input)
- Button variant: 'danger' vs design 'error' -- minor naming diff

## Convention Patterns
- Naming conventions: 100% compliance
- 'use client' directives: correctly applied (pure UI components omit it)
- Import order: features -> shared -> store -> widgets
- Env variables: 3/3 now all present
