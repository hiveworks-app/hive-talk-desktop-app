import { BrowserWindow, session, screen } from 'electron';
import { getPreloadPath, getIconPath } from './utils';

export function createWindow(
  serverUrl: string,
  deps: { getIsQuitting: () => boolean },
): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: 400,
    height: 640,
    minWidth: 400,
    minHeight: 640,
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
    { urls: ['*://*.treefrog.kr/*', '*://treefrog.kr/*', '*://*.ncloudstorage.com/*'] },
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

  // ESC 키 → 창 숨기기 (트레이로 최소화)
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown' && !input.alt && !input.control && !input.meta) {
      win.hide();
    }
  });

  return win;
}
