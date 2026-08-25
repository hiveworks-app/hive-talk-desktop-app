import { BrowserWindow, session, screen } from 'electron';
import { getPreloadPath, getIconPath } from './utils';

let escSuppressed = false;

export function setEscSuppressed(value: boolean) {
  escSuppressed = value;
}

/** 기본 창 폭 — 창 크기는 앱이 임의로 바꾸지 않는다.
 *  채팅방 진입/이탈 자동 폭 조절(480↔960)은 제거됨 (사용자 결정 2026-08-21).
 *  시작 폭은 자동 조절 도입 이전의 원래 값(480)을 유지한다 — 임의 변경 금지. */
export const WINDOW_WIDTH_DEFAULT = 480;

// ─── 멀티 채팅창 (프로토타입 2026-08-21) ───
// 방별 팝업 창 레지스트리 — 같은 방은 새 창 대신 기존 창 포커스
const chatWindows = new Map<string, BrowserWindow>();

/** 채팅 목록 우클릭 '새 창에서 열기' — 대화 단독 팝업 창.
 *  경로는 팝업 전용 라우트(/chat-popup/{roomId}) — (main) 셸(네비·전역 안내·자동 업데이트)을 타지 않는다. */
export function openChatWindow(serverUrl: string, path: string, roomId: string) {
  const existing = chatWindows.get(roomId);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: Math.min(520, screenWidth),
    height: Math.min(720, screenHeight),
    minWidth: Math.min(400, screenWidth),
    minHeight: Math.min(480, screenHeight),
    title: 'HiveTalk',
    icon: getIconPath(),
    // 콘텐츠 준비 전 빈 창이 깜빡이지 않도록 숨겨서 만들고 ready-to-show에서 표시 (메인 창과 동일 패턴).
    // backgroundColor는 첫 페인트 전 기본 흰 배경 대신 앱 배경색을 쓰게 한다.
    show: false,
    backgroundColor: '#FFFFFF',
    // 팝업은 OS 기본 타이틀바 사용 (메인 창의 hiddenInset·드래그 바 체계와 분리)
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // dev에서 라우트 온디맨드 컴파일이 길어지면 ready-to-show가 늦게 와 창이 안 뜬 것처럼 보인다 —
  // 일정 시간 뒤에는 스피너 상태로라도 표시하는 안전망 (프로덕션은 ready-to-show가 먼저 도착).
  const showFallback = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) win.show();
  }, 1200);
  win.once('ready-to-show', () => {
    clearTimeout(showFallback);
    win.show();
  });
  // 고정 배율(100%) 강제 — 줌은 origin별로 세션에 영구 저장되므로(createWindow와 동일 이유) 팝업도 항상 초기화
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(1);
  });
  // 팝업은 트레이 최소화 없이 그냥 닫힘 (메인 창 전용 동작 미적용)
  win.on('closed', () => {
    clearTimeout(showFallback);
    chatWindows.delete(roomId);
  });
  void win.loadURL(`${serverUrl}${path}`);
  chatWindows.set(roomId, win);
}

/** 열려 있는 모든 팝업 창에 IPC 이벤트를 보낸다 (WS 중계용) */
export function broadcastToChatWindows(channel: string, payload: unknown) {
  chatWindows.forEach(win => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  });
}

/** 앱 종료/로그아웃 시 팝업 정리 — 팝업은 허브(메인 창)의 소켓에 의존하므로 혼자 남으면 죽은 창이 된다 */
export function closeAllChatWindows() {
  chatWindows.forEach(win => {
    if (!win.isDestroyed()) win.close();
  });
  chatWindows.clear();
}

export function createWindow(
  serverUrl: string,
  deps: { getIsQuitting: () => boolean },
): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    // 작은 디스플레이에서 화면보다 커지지 않도록 작업영역으로 클램프.
    width: Math.min(WINDOW_WIDTH_DEFAULT, screenWidth),
    height: Math.min(800, screenHeight),
    minWidth: Math.min(440, screenWidth),
    minHeight: Math.min(600, screenHeight),
    maxWidth: screenWidth,
    maxHeight: screenHeight,
    title: 'HiveTalk',
    icon: getIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 10, y: 10 } }
      : {
          titleBarOverlay: {
            color: '#ffffff',
            symbolColor: '#333333',
            height: 32,
          },
        }),
  });

  // CORS 우회: API 서버 + NCloud Object Storage 도메인에 대해 CORS 헤더 재설정
  // URL 필터를 사용하여 localhost 페이지/에셋 로딩에 영향을 주지 않음
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['*://*.hiveworks.co.kr/*', '*://hiveworks.co.kr/*', '*://*.ncloudstorage.com/*'] },
    (details, callback) => {
      const headers = { ...details.responseHeaders };

      for (const key of Object.keys(headers)) {
        if (key.toLowerCase().startsWith('access-control-')) {
          delete headers[key];
        }
      }

      headers['Access-Control-Allow-Origin'] = [serverUrl];
      headers['Access-Control-Allow-Headers'] = ['Content-Type, Authorization, X-Requested-With'];
      headers['Access-Control-Allow-Methods'] = ['GET, POST, PUT, PATCH, DELETE, OPTIONS'];
      headers['Access-Control-Allow-Credentials'] = ['true'];

      if (details.method === 'OPTIONS') {
        callback({ responseHeaders: headers, statusLine: 'HTTP/1.1 200 OK' });
      } else {
        callback({ responseHeaders: headers });
      }
    },
  );

  win.loadURL(serverUrl);

  // 고정 배율(100%) 강제 — Electron은 setZoomFactor로 설정된 줌을 origin별로
  // 세션 데이터에 영구 저장하므로, 과거에 저장된 배율이 남아 있어도 항상 100%로 초기화한다.
  // (확대/축소 기능 자체를 제공하지 않는 앱 — 카톡 PC와 동일한 고정 크기 정책)
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(1);
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // Close → tray (채팅앱이므로 트레이 최소화)
  win.on('close', (e) => {
    if (!deps.getIsQuitting()) {
      e.preventDefault();
      win.hide();
    }
  });

  win.on('focus', () => {
    win.flashFrame(false);
  });

  // ESC 키 → 창 숨기기 (트레이로 최소화, overlay가 열려있으면 무시)
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown' && !input.alt && !input.control && !input.meta && !escSuppressed) {
      win.hide();
    }
  });

  return win;
}
