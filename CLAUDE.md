# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

- 한국어로 대답해주세요.

# 프로젝트 개요

**HiveTalk Desktop** - Next.js 16 + Electron 40 기반 실시간 채팅 데스크톱 애플리케이션

## 핵심 기술 스택

- **Core:** Next.js 16 (App Router), React 19, TypeScript 5
- **Desktop:** Electron 40 (utilityProcess.fork 기반 Next.js 서버 통합)
- **Styling:** Tailwind CSS 4
- **State Management:**
  - Server State: TanStack Query (React Query) v5
  - Client State: Zustand v5 (persist → localStorage)
- **Real-time:** WebSocket (native) + STOMP protocol
- **UI:** Radix UI (Dialog, Dropdown, Toast, Tabs, Tooltip), react-virtuoso
- **Build:** electron-builder (DMG, NSIS, AppImage)

## 개발 명령어

```bash
# 웹 개발 서버 (localhost:23000)
npm run dev

# Electron + Next.js 동시 개발
npm run electron:dev

# Electron TypeScript 컴파일
npm run electron:compile

# 프로덕션 빌드 (Next.js → TS compile → electron-builder)
npm run electron:build

# 패키징만 (설치 파일 미생성, 테스트용)
npm run electron:pack

# 린트
npm run lint
```

## Path Aliases

```typescript
import { Button } from '@/shared/ui/Button';
import { useAuthStore } from '@/store/auth/authStore';
```

- `@/*` → `src/*`

---

# 프로젝트 구조 (FSD 아키텍처)

Feature-Sliced Design 아키텍처를 적용하여 관심사를 분리한다.

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                # 인증 라우트 그룹
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (main)/                # 인증 후 메인 라우트 그룹
│   │   ├── chat/             # 채팅 (목록 + [roomId])
│   │   ├── members/
│   │   ├── external-members/
│   │   └── settings/
│   ├── layout.tsx             # 루트 레이아웃 (ReactQueryProvider)
│   └── page.tsx               # 진입점 (/ → /chat 리다이렉트)
├── features/                   # 비즈니스 기능 단위
│   ├── {feature}/
│   │   ├── api.ts             # API 호출 함수
│   │   ├── queries.ts         # TanStack Query hooks
│   │   ├── type.ts            # 타입 정의
│   │   └── use{Feature}.ts    # 비즈니스 로직 훅
├── shared/                     # 공용 모듈
│   ├── api/                   # HTTP 클라이언트 (request, refreshAccessToken)
│   ├── config/                # 상수 (queryKeys.ts, constants.ts)
│   ├── hooks/                 # 공용 훅 (useDebounce, useSearch)
│   ├── types/                 # 공용 타입 (websocket, chatRoom, user, etc.)
│   ├── ui/                    # 공용 UI (Button, Input, Badge, ProfileCircle, etc.)
│   ├── utils/                 # 유틸리티 (chatUtils, fileUtils, formatTime, etc.)
│   ├── websocket/             # WebSocketContext, useWebSocketMessageBuilder
│   └── providers/             # ReactQueryProvider
├── store/                      # Zustand 전역 상태
│   ├── auth/authStore.ts      # 인증 (accessToken, refreshToken, deviceInfo, user)
│   ├── chat/chatRoomStore.ts  # 채팅방 메타 정보
│   ├── chat/chatRoomRuntimeStore.ts  # 채팅방 런타임 상태 (messages 등)
│   ├── chat/uploadProgressStore.ts   # 파일 업로드 진행률
│   ├── uiStore.ts             # UI 상태 (snackbar 등)
│   └── themeStore.ts          # 테마 설정
└── widgets/                    # 복합 UI 컴포넌트
    ├── chat-room/             # ChatInput, MessageBubble, DateSeparator
    ├── chat-room-list/        # ChatRoomListSidebar
    ├── create-room/           # CreateRoomDialog
    ├── nav/                   # AppNav (좌측 네비게이션)
    ├── profile/               # MyProfileDialog, UserProfileDialog
    └── side-panel/            # SidePanel (우측 패널)

electron/
├── main.ts                     # Electron 메인 프로세스
├── preload.ts                  # IPC 브릿지 (contextBridge)
└── tsconfig.json               # Electron용 TypeScript 설정
```

**원칙:**
- `features/`의 각 폴더는 독립적인 비즈니스 도메인을 담당
- `api.ts`, `queries.ts`, `type.ts`를 명확히 분리
- `shared/`는 도메인에 종속되지 않는 범용 코드만 포함

---

# 개발 규약

## 공통 코딩 컨벤션

- **Linting:** ESLint 설정을 준수한다.
- **Type Safety:**
  - `any` 타입 사용 금지 (불가피한 경우 `unknown` 사용 후 타입 가드 처리).
  - Type Assertion (`as`) 사용 지양.
  - 서버 응답 데이터는 반드시 별도 Interface/Type으로 정의.
- **Error Handling:** 비동기 로직은 적절히 에러 처리하고 사용자 피드백(snackbar 등)을 제공한다.

## 컴포넌트 구조

- **함수 컴포넌트** 사용을 원칙으로 한다.
- 클라이언트 컴포넌트는 `"use client"` 지시문을 파일 최상단에 명시한다.
- 파일명은 `PascalCase`, 커스텀 훅은 `use` prefix를 사용한다.
- 조건부 스타일링은 `cn()` 유틸 (`clsx` + `tailwind-merge`)로 처리한다.

## 상태 관리

- **Server State:** TanStack Query. Query Key는 반드시 `queryKeys.ts`에 상수로 정의.
- **Client State:** Zustand. 인증 상태는 `persist` 미들웨어로 localStorage에 저장.
- **WebSocket ↔ React Query 동기화:**
  - WebSocket 메시지 수신 시 `queryClient.setQueryData()`로 즉시 캐시 업데이트.
  - `invalidateQueries()`는 신규 방 등 예외 상황에만 사용.

## Hooks 사용 규칙

- **단일 책임 원칙:** 하나의 Hook은 하나의 비즈니스 로직만 담당한다.
- **useEffect 제한:** "외부 시스템과의 동기화" 목적으로만 사용. 사용자 액션은 Event Handler에서 처리.

## 커밋 및 PR 규약

- **커밋 메시지**: 대괄호 태그 사용 - `[feat]:`, `[fix]:`, `[hotFix]:`, `[refactor]:`
- **브랜치 네이밍**: `feat/...`, `fix/...`, `hotfix/...`

---

# 아키텍처 핵심 개념

## 1. 인증 시스템

```
로그인 → Zustand(persist) + has-auth 쿠키 → middleware 라우트 보호
토큰 만료 → API 클라이언트 401 감지 → refreshAccessToken() → 자동 재시도
```

- **middleware.ts**: `has-auth` 쿠키로 서버사이드 라우트 보호 (토큰은 localStorage에만 저장)
- **authStore.ts**: `accessToken`, `refreshToken`, `deviceInfo`, `user` persist
- **refreshAccessToken.ts**: auth store의 `deviceInfo`에서 deviceId를 읽어 일관성 보장 (RN 앱과 동일 패턴)
- **API 클라이언트**: 401 응답 시 `SC001`/`SC002` 코드면 자동 refresh 후 재시도

## 2. WebSocket 실시간 통신

```
WebSocketProvider (전역)
  ├─ 연결 관리 (지수 백오프 재연결, 최대 10회)
  ├─ 401 종료 시 토큰 갱신 후 재연결
  ├─ Pending Queue (재연결 중 메시지 큐잉)
  └─ 메시지 타입별 처리:
      ├─ isPublish()      → 채팅방 목록 캐시 갱신 + 웹 알림
      ├─ isReadMessage()   → 읽음 카운트 업데이트
      ├─ isDeleteMessage() → 메시지 삭제 반영
      ├─ isRoomInvite()    → 자동 구독
      ├─ isAddTag/RemoveTag → 태그 업데이트
      └─ isExitRoom()      → 참여자 상태 업데이트
```

- **Listener 패턴**: `addListener(roomId, callback)` - 방별로 메시지 수신
- **Type Guard 기반 파싱**: `isPublish()`, `isReadMessage()` 등으로 타입 안전성 보장
- **visibilitychange**: 탭 전환 시 연결 관리 (AppState 대체)

## 3. 데이터 레이어

```
WebSocket ←→ React Query Cache ←→ Zustand Store
```

- **WebSocket**: 실시간 메시지 수신 및 서버 이벤트 브로드캐스트
- **React Query**: 서버 상태 캐싱 (채팅방 목록 DM/GM/EM 분리)
- **Zustand**: 클라이언트 런타임 상태 (채팅방 메타정보, 메시지 리스트, 업로드 진행률)

### Query Key 관리

```typescript
// src/shared/config/queryKeys.ts
export const DM_ROOM_LIST_KEY = ['dmRoomList'];
export const GM_ROOM_LIST_KEY = ['gmRoomList'];
export const EM_ROOM_LIST_KEY = ['emRoomList'];
```

## 4. Electron 데스크톱 통합

### 프로덕션 아키텍처

```
Electron Main Process
  ├─ utilityProcess.fork(server.js)   # Next.js standalone 서버
  ├─ BrowserWindow.loadURL(serverUrl) # 내장 브라우저에서 로드
  ├─ webRequest.onHeadersReceived     # CORS 헤더 주입 (treefrog.kr만)
  ├─ Tray                             # 시스템 트레이 (종료 시 최소화)
  └─ requestSingleInstanceLock()      # 중복 실행 방지
```

### 포트 관리

- 포트 23000 선호 (API 서버 CORS 설정과 일치)
- 사용 중이면 `findFreePort()`로 랜덤 포트 할당 + CORS 헤더 주입

### IPC 브릿지 (preload.ts)

```typescript
window.electronAPI.showNotification(title, body)
window.electronAPI.getAppVersion()
window.electronAPI.setBadgeCount(count)
window.electronAPI.isElectron  // boolean
```

### CORS 우회

- `session.defaultSession.webRequest.onHeadersReceived`로 treefrog.kr 도메인에만 CORS 헤더 주입
- **중요**: URL 필터 없이 등록하면 모든 응답(HTML/JS/CSS)을 가로채서 빈 화면 발생

---

# 핵심 파일 및 역할

| 파일 | 역할 |
|------|------|
| `electron/main.ts` | Electron 메인 프로세스 (서버 관리, CORS, 트레이, IPC) |
| `electron/preload.ts` | IPC 브릿지 (contextBridge) |
| `src/middleware.ts` | Next.js 라우트 보호 (has-auth 쿠키) |
| `src/shared/api/index.ts` | HTTP 클라이언트 (request, 401 자동 재시도) |
| `src/shared/api/refreshAccessToken.ts` | 토큰 갱신 (auth store의 deviceInfo 사용) |
| `src/shared/websocket/WebSocketContext.tsx` | 전역 WebSocket 관리 + React Query 캐시 동기화 |
| `src/features/chat-room/useChatRoomController.ts` | 채팅방 비즈니스 로직 컨트롤러 |
| `src/features/chat-room/useChatRoomActions.ts` | 메시지 전송 로직 |
| `src/store/auth/authStore.ts` | 인증 상태 (persist → localStorage) |

---

# 개발 시 주의사항

## Electron + Next.js 통합

- `next.config.ts`에서 `output: 'standalone'` 필수 (Electron 번들링용)
- electron-builder.yml의 `extraResources`로 standalone + static + public 번들링
- 개발 시 `electron:dev` 사용, 프로덕션 빌드 시 `electron:build` 사용

## WebSocket 리스너 정리

```typescript
useEffect(() => {
  addListener(roomId, handleWsMessage);
  return () => removeListener(roomId); // 필수
}, [roomId]);
```

## React Query 캐시 불변성

```typescript
// Good: 새 객체 반환
queryClient.setQueryData(KEY, prev => [...prev, newItem]);

// Bad: 기존 배열 변경
queryClient.setQueryData(KEY, prev => { prev.push(newItem); return prev; });
```

## 환경 변수

```env
NEXT_PUBLIC_API_URL=   # API 서버 URL (treefrog.kr)
NEXT_PUBLIC_WS_URL=    # WebSocket 서버 URL
```

---

# 테스트 규약

- 현재 테스트 스크립트가 별도로 구성되어 있지 않습니다.
- 테스트를 추가할 경우 `__tests__/` 또는 `*.test.ts(x)` 규칙을 권장합니다.
