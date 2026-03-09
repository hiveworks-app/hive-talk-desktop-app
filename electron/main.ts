import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification, utilityProcess, UtilityProcess, session, screen } from 'electron';
import path from 'path';
import net from 'net';

const isDev = !app.isPackaged;
const DEV_PORT = 23000;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let nextServer: UtilityProcess | null = null;
let isQuitting = false;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  return isDev
    ? path.join(app.getAppPath(), 'resources', iconName)
    : path.join(process.resourcesPath, iconName);
}

function getTrayIconPath() {
  const base = isDev
    ? path.join(app.getAppPath(), 'resources')
    : process.resourcesPath;
  return path.join(base, 'trayIconTemplate.png');
}

/** Check if a specific port is available */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

/** Find a free port for the production Next.js server */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

/** Wait until the given URL responds */
function waitForServer(url: string, timeout = 30_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      fetch(url)
        .then((res) => {
          if (res.ok || res.status < 500) resolve();
          else retry();
        })
        .catch(retry);
    };
    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error(`Server did not start within ${timeout}ms`));
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

// ------------------------------------------------------------------
// Next.js server (production)
// ------------------------------------------------------------------

async function startNextServer(): Promise<string> {
  if (isDev) return `http://localhost:${DEV_PORT}`;

  // 23000번 포트 우선 사용 (API 서버 CORS 설정과 일치)
  // 사용 중이면 랜덤 포트로 fallback
  const preferred = await isPortAvailable(DEV_PORT);
  const port = preferred ? DEV_PORT : await findFreePort();

  const standaloneDir = path.join(process.resourcesPath, 'standalone', 'hiveworks', 'hive-talk-desktop-app');
  const serverPath = path.join(standaloneDir, 'server.js');

  nextServer = utilityProcess.fork(serverPath, [], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: 'localhost',
    },
  });

  nextServer.stdout?.on('data', (d) => console.log('[next]', d.toString().trim()));
  nextServer.stderr?.on('data', (d) => console.error('[next]', d.toString().trim()));

  const url = `http://localhost:${port}`;
  await waitForServer(url);
  return url;
}

// ------------------------------------------------------------------
// Window
// ------------------------------------------------------------------

function createWindow(serverUrl: string) {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
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
      ? { trafficLightPosition: { x: 16, y: 16 } }
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

      // 기존 CORS 헤더 삭제 (대소문자 무관)
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase().startsWith('access-control-')) {
          delete headers[key];
        }
      }

      // 새 CORS 헤더 설정 - 실제 origin 사용
      headers['Access-Control-Allow-Origin'] = [serverUrl];
      headers['Access-Control-Allow-Headers'] = ['Content-Type, Authorization, X-Requested-With'];
      headers['Access-Control-Allow-Methods'] = ['GET, POST, PUT, PATCH, DELETE, OPTIONS'];
      headers['Access-Control-Allow-Credentials'] = ['true'];

      // OPTIONS preflight: NCloud에 CORS가 미설정이면 403/405 응답 → 강제 200으로 변환
      if (details.method === 'OPTIONS') {
        callback({ responseHeaders: headers, statusLine: 'HTTP/1.1 200 OK' });
      } else {
        callback({ responseHeaders: headers });
      }
    },
  );

  mainWindow.loadURL(serverUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Close → tray (채팅앱이므로 트레이 최소화)
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

}

// ------------------------------------------------------------------
// Tray
// ------------------------------------------------------------------

function createTray() {
  let icon: Electron.NativeImage;

  if (process.platform === 'darwin') {
    icon = nativeImage.createFromPath(getTrayIconPath());
    icon.setTemplateImage(true);
  } else {
    icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);
  tray.setToolTip('HiveTalk');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'HiveTalk 열기',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: '잠금모드',
      click: () => {
        mainWindow?.webContents.send('tray-lock-mode');
        mainWindow?.show();
      },
    },
    { type: 'separator' },
    {
      label: '로그아웃',
      click: () => {
        mainWindow?.webContents.send('tray-logout');
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

// ------------------------------------------------------------------
// IPC Handlers
// ------------------------------------------------------------------

ipcMain.handle('show-notification', (_event, title: string, body: string) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, icon: getIconPath() }).show();
  }
});

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('set-badge-count', (_event, count: number) => {
  if (process.platform === 'darwin') {
    app.setBadgeCount(count);
  }
  // Windows: overlay icon could be used here
});

// ------------------------------------------------------------------
// App lifecycle
// ------------------------------------------------------------------

// 단일 인스턴스 잠금 - 앱이 이미 실행 중이면 두 번째 실행 차단
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('quit', () => {
  nextServer?.kill();
});

app.whenReady().then(async () => {
  // macOS 메뉴바 앱 이름 설정
  app.setName('HiveTalk');

  if (process.platform === 'darwin') {
    const appMenu = Menu.buildFromTemplate([
      {
        label: 'HiveTalk',
        submenu: [
          { role: 'about', label: 'HiveTalk에 관하여' },
          { type: 'separator' },
          { role: 'hide', label: 'HiveTalk 숨기기' },
          { role: 'hideOthers', label: '다른 앱 숨기기' },
          { role: 'unhide', label: '모두 보기' },
          { type: 'separator' },
          { role: 'quit', label: 'HiveTalk 종료' },
        ],
      },
      {
        label: '편집',
        submenu: [
          { role: 'undo', label: '실행 취소' },
          { role: 'redo', label: '다시 실행' },
          { type: 'separator' },
          { role: 'cut', label: '잘라내기' },
          { role: 'copy', label: '복사' },
          { role: 'paste', label: '붙여넣기' },
          { role: 'selectAll', label: '전체 선택' },
        ],
      },
      {
        label: '보기',
        submenu: [
          { role: 'reload', label: '새로고침' },
          { role: 'toggleDevTools', label: '개발자 도구' },
          { type: 'separator' },
          { role: 'zoomIn', label: '확대' },
          { role: 'zoomOut', label: '축소' },
          { role: 'resetZoom', label: '원래 크기' },
        ],
      },
      {
        label: '윈도우',
        submenu: [
          { role: 'minimize', label: '최소화' },
          { role: 'zoom', label: '확대/축소' },
          { type: 'separator' },
          { role: 'front', label: '앞으로 가져오기' },
        ],
      },
    ]);
    Menu.setApplicationMenu(appMenu);
  } else {
    Menu.setApplicationMenu(null);
  }

  try {
    const serverUrl = await startNextServer();
    createWindow(serverUrl);
    createTray();
  } catch (err) {
    console.error('Failed to start:', err);
    app.quit();
  }
});
