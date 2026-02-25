---
name: project-guide
description: Develop features using Expo/RN/FSD architecture, adhering to strict State/Ref separation, no-useEffect-for-actions rule, and performance optimizations (FlashList, NativeProps).
argument-hint: Feature description or logic requirements (e.g. "Create ChatInput with debounce")
---

- 한국어로 대답해주세요.

# 프로젝트 개발 환경

## 프로젝트 구조 규약(FSD 아키텍처)

- **Feature-Sliced Design(FSD)** 아키텍처를 적용하여 관심사를 분리한다.
- **폴더 구조 예시:**
  app/ # Expo Router (파일 기반 라우팅)
  src/
  |-- features/ # 비즈니스 기능 단위 (api, model, ui, queries 분리)
  |-- screens/ # 화면 단위
  |-- shared/ # 공용 유틸, UI 키트, 설정, 훅
  |-- store/ # 전역 상태 (Zustand)
  |-- theme # 테마 설정, 폰트, 색상 관련 설정
  |-- widgets/ # 독립적인 기능을 가진 복합 컴포넌트 (BottomBar 등)

## 기술 스택

- **Core:** React, React Native, Expo, TypeScript
- **Styling:** Tailwind CSS (NativeWind)
- **State Management:**
  - Server State: React Query (TanStack Query)
  - Client State: Zustand
- **Navigation:** Expo Router (React Navigation 기반)
- **List:** FlashList (Shopify)
- **Animation:** React Native Reanimated

# 개발 규약

## 공통 코딩 컨벤션

- **Linting:** ESLint, Prettier 설정을 엄격히 준수한다.
- **Type Safety:**
  - `any` 타입 사용 금지 (불가피한 경우 `unknown` 사용 후 타입 가드 처리).
  - Type Assertion (`as`) 사용 지양.
  - 서버 응답 데이터는 반드시 별도 Interface/Type으로 정의.
- **Error Handling:** 비동기 로직 및 위험 구간은 `try-catch`로 감싸고 사용자 피드백(Toast 등)을 제공한다.
- **Logging:**
  - 의미 없는 로그 금지.
  - 주요 로직은 Prefix 사용 (`[SEARCH]`, `[WS]`, `[UPLOAD]`).
  - 배포 시 로그 제거 설정 확인.

# React & Hooks 규약

## 컴포넌트 구조

- **함수 컴포넌트** 사용을 원칙으로 한다.
- 파일명은 `PascalCase`, 커스텀 훅은 `use` prefix를 사용한다.
- **Props:** Optional(`?`) 남용을 금지하고, 명확한 타입을 정의한다.
- 조건부 스타일링은 `className` 조합(clsx, tw-merge 등)으로 처리하며, `StyleSheet.create`는 사용하지 않는다.

## 상태 관리 (State vs Ref) 규칙

- **UI 렌더링용:** `useState`, `zustand` (값이 바뀌면 화면이 다시 그려져야 하는 경우).
- **로직 제어용:** `useRef` (값이 바뀌어도 리렌더링이 필요 없는 플래그, 타이머 ID, 이전 값 비교 등).
  - _예시: 검색어(`keyword`)는 State, 검색 중복 방지 플래그(`isSearching`)는 Ref._

## Hooks 및 Effect 사용 규칙

- **단일 책임 원칙:** 하나의 Hook은 하나의 비즈니스 로직만 담당한다.
- **useEffect 제한:**
  - `useEffect`는 **"외부 시스템과의 동기화"** 목적으로만 사용한다.
  - **사용자 액션(클릭, 입력)에 의한 로직은 `useEffect`가 아닌 Event Handler에서 처리한다.**
- **Handler 관리:** 이벤트 핸들러는 `useCallback`으로 감싸 불필요한 재생성을 방지한다.

## 비동기 및 데이터 Fetching

- React Query의 **Query Key는 반드시 상수(`queryKeys.ts`)로 관리**한다.
- API 호출 함수, Query Hooks, 타입 정의를 파일별로 분리한다 (`api.ts`, `queries.ts`, `type.ts`).

## 성능 최적화 규약 (FlashList & Animation)

- **리스트 최적화:**
  - `renderItem`은 `useCallback`으로 감싸거나 별도 컴포넌트로 분리하여 Memoization 한다.
  - `renderItem` 내부에서 익명 함수(`() => ...`) 정의를 금지한다.
- **애니메이션:**
  - JS 스레드 부하를 줄이기 위해 `Reanimated`의 `useSharedValue`, `useAnimatedStyle`을 사용한다.
- **입력 최적화:**
  - 고속 타이핑/입력 이슈 방지를 위해 `TextInput` 제어 시 `ref.current.setNativeProps`나 `clear()` 활용을 고려한다.

## 네비게이션 및 라우팅

- 화면 이동 시 존재하지 않는 라우트로의 이동을 방지하기 위해 Type-safe한 라우터(`useSafeRouter` 등)를 사용한다.
- 중복 이동 방지(Debounce) 처리를 포함한다.

---

# 플랫폼 별 네이티브 설정 및 배포 규약

## iOS 설정 (Notification Extension)

### Target 및 버전 관리

- **Bundle ID:** Extension의 Bundle ID는 반드시 메인 앱의 하위 도메인 규칙(`[MainAppBundleID].[ExtensionName]`)을 준수한다.
- **Minimum Deployments:** Extension의 최소 지원 버전은 메인 앱과 동일하거나 더 낮게 설정한다 (안정성을 위해 **iOS 13.0** 또는 **14.0** 권장).
- **코드 호환성:** `SiriKit` 등 최신 기능 사용 시, 하위 버전 충돌 방지를 위해 `if #available(iOS 15.0, *)` 분기 처리를 필수로 적용한다.

### 빌드 설정 및 에러 방지 (Cycle Error & Debugging)

- **빌드 순서(Scheme):** 메인 앱과 Extension 간의 의존성 충돌(Cycle Error)을 방지하기 위해, **Scheme 설정에서 Extension을 메인 앱보다 상단(먼저 빌드)**에 배치한다.
- **수정 사항 반영:** 개발(Debug) 단계에서는 `Build Phases` > `Embed Foundation Extensions` 항목의 **`Copy only when installing` 옵션을 해제(Off)**하여, 빌드 시마다 수정된 코드가 기기에 반영되도록 한다.

### 기능 구현 (Communication Notifications)

- 카카오톡 스타일(프로필 이미지 포함) 알림을 위해 `Notification Service Extension` 내부에서 `INSendMessageIntent`를 구현한다.
- `Info.plist`에 `NSUserActivityTypes` 키를 추가하고 `INSendMessageIntent`를 등록해야 한다.

## Android 설정 (FCM & Headless JS)

### 알림 처리 방식

- Android는 시스템 트레이 알림과 앱 내부 로직 간의 중복 표시를 방지하기 위해 **Data-only 메시지 수신**을 원칙으로 한다.
- 수신된 데이터는 `Headless JS` (백그라운드) 또는 앱 내부 이벤트 리스너(포그라운드)를 통해 처리하며, 필요시 앱 코드단에서 `LocalNotification`을 생성한다.

## FCM (Firebase Cloud Messaging) 페이로드 규약

백엔드에서 Push 발송 시, 하나의 요청에 **Android(Data-only)**와 **iOS(Notification + Extension Trigger)** 설정을 분리하여 전송해야 한다.

- **공통 (`data`):** 비즈니스 로직 처리를 위한 데이터(`roomId`, `sender`, `profileUrl` 등) 포함.
- **Android (`android`):** `notification` 필드를 **제외**하여 Data-only로 전송.
- **iOS (`apns`):** Extension 실행을 위해 `alert` 객체와 `mutable-content: 1` 필드를 필수적으로 포함.

```json
// FCM v1 API 발송 예시 (Backend 규격)
{
  "message": {
    "token": "DEVICE_TOKEN",

    // [공통] 앱 로직 처리용 데이터 (이미지 URL 포함)
    "data": {
      "roomId": "room_123",
      "messageModel": "{\"sender\":{\"name\":\"홍길동\", \"profileUrl\":\"https://...\"}, ...}"
    },

    // [Android] 알림 필드 없음 (Data-only 유지)
    "android": {
      "priority": "high"
    },

    // [iOS] 시스템 알림 표시 및 Extension 실행 트리거
    "apns": {
      "payload": {
        "aps": {
          // 1. 시스템 알림 필수 정보
          "alert": {
            "title": "홍길동",
            "body": "사진을 보냈습니다."
          },
          // 2. Notification Service Extension 실행 스위치 (필수)
          "mutable-content": 1
        }
      }
    }
  }
}
```
