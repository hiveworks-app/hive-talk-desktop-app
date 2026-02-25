# HiveTalk Desktop

Next.js 16 + Electron 40 기반 실시간 채팅 데스크톱 애플리케이션

## Tech Stack

- **Framework:** Next.js 16 (App Router, standalone output)
- **Runtime:** React 19, TypeScript 5
- **Desktop:** Electron 40 (utilityProcess.fork)
- **Styling:** Tailwind CSS 4
- **State:** Zustand 5 (client) + TanStack Query 5 (server)
- **Real-time:** WebSocket (native) + STOMP protocol
- **UI:** Radix UI primitives, react-virtuoso

## Getting Started

```bash
# 의존성 설치
npm install

# 웹 개발 서버 (localhost:23000)
npm run dev

# Electron 개발 모드 (Next.js + Electron 동시 실행)
npm run electron:dev
```

## Build

```bash
# 프로덕션 빌드 (Next.js build → TypeScript compile → electron-builder)
npm run electron:build
```

빌드 산출물: `release/HiveTalk-{version}-{arch}.dmg`

### Build Targets

| Platform | Format | Architecture |
|----------|--------|-------------|
| macOS | DMG | arm64 |
| Windows | NSIS | x64 |
| Linux | AppImage | x64 |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 인증 페이지 (login, signup)
│   └── (main)/            # 인증 후 메인 (chat, members, settings)
├── features/              # 비즈니스 기능 단위 (FSD)
│   ├── auth/              # 인증 (api, queries, type)
│   ├── chat-room/         # 채팅방 (controller, actions, search, domain)
│   ├── chat-room-list/    # 채팅방 목록
│   ├── chat-room-side-panel/
│   ├── create-chat-room/
│   ├── external-chat/     # 외부 채팅
│   ├── external-member/
│   ├── members/
│   ├── profile/
│   └── tag/
├── shared/                # 공용 모듈
│   ├── api/               # HTTP 클라이언트 (request, refreshAccessToken)
│   ├── config/            # 상수, queryKeys
│   ├── hooks/             # useDebounce, useSearch
│   ├── types/             # 공용 타입 (websocket, chatRoom, user, etc.)
│   ├── ui/                # 공용 UI (Button, Input, Badge, etc.)
│   ├── utils/             # 유틸리티 함수
│   ├── websocket/         # WebSocketContext, messageBuilder
│   └── providers/         # ReactQueryProvider
├── store/                 # Zustand 전역 상태
│   ├── auth/              # authStore (persist → localStorage)
│   └── chat/              # chatRoomStore, runtimeStore, uploadProgress
└── widgets/               # 복합 UI 컴포넌트
    ├── chat-room/         # ChatInput, MessageBubble, DateSeparator
    ├── chat-room-list/    # ChatRoomListSidebar
    ├── create-room/       # CreateRoomDialog
    ├── nav/               # AppNav
    ├── profile/           # MyProfileDialog, UserProfileDialog
    └── side-panel/        # SidePanel

electron/
├── main.ts                # Electron 메인 프로세스
├── preload.ts             # IPC 브릿지 (contextBridge)
└── tsconfig.json          # Electron용 TypeScript 설정
```

## Environment Variables

```env
NEXT_PUBLIC_API_URL=       # API 서버 URL
NEXT_PUBLIC_WS_URL=        # WebSocket 서버 URL
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js 개발 서버 (port 23000) |
| `npm run build` | Next.js 프로덕션 빌드 |
| `npm run electron:dev` | Electron + Next.js 동시 개발 |
| `npm run electron:compile` | Electron TypeScript 컴파일 |
| `npm run electron:build` | 프로덕션 DMG/NSIS/AppImage 빌드 |
| `npm run electron:pack` | 빌드 (패키징만, 설치 파일 미생성) |
| `npm run lint` | ESLint 실행 |
