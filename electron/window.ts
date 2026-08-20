import { BrowserWindow, session, screen } from 'electron';
import { getPreloadPath, getIconPath } from './utils';

let escSuppressed = false;

export function setEscSuppressed(value: boolean) {
  escSuppressed = value;
}

/** 평상시(목록·멤버·설정) 단일 컬럼 폭 */
export const WINDOW_WIDTH_NARROW = 480;
/** 채팅방(목록 + 대화) 멀티컬럼 폭 — md(768) 이상이라 사이드바+대화가 함께 보인다 */
export const WINDOW_WIDTH_CHAT = 960;

/**
 * 채팅방 진입/이탈에 따라 창 폭을 동적으로 조절한다.
 * 진입 시 우측으로 확장(좌측 고정, 화면 오른쪽을 넘으면 좌측으로 슬라이드), 이탈 시 좁게 복귀.
 * 최대화·전체화면 상태에서는 건드리지 않는다.
 */
export function resizeWindowForChat(win: BrowserWindow | null, chatActive: boolean) {
  if (!win || win.isDestroyed() || win.isMaximized() || win.isFullScreen()) return;

  const { workArea } = screen.getDisplayMatching(win.getBounds());
  const target = chatActive ? WINDOW_WIDTH_CHAT : WINDOW_WIDTH_NARROW;
  const width = Math.min(target, workArea.width);

  const bounds = win.getBounds();
  if (bounds.width === width) return;

  let x = bounds.x;
  if (x + width > workArea.x + workArea.width) {
    x = Math.max(workArea.x, workArea.x + workArea.width - width);
  }

  // 두 번째 인자(animate)는 macOS에서만 동작 — 부드러운 슬라이드 확장
  win.setBounds({ x, y: bounds.y, width, height: bounds.height }, true);
}

export function createWindow(
  serverUrl: string,
  deps: { getIsQuitting: () => boolean },
): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    // 평상시(목록·멤버·설정)는 좁은 단일 컬럼으로 연다. 채팅방 진입 시 우측으로 확장한다(resizeWindowForChat).
    // 작은 디스플레이에서 화면보다 커지지 않도록 작업영역으로 클램프.
    width: Math.min(WINDOW_WIDTH_NARROW, screenWidth),
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
