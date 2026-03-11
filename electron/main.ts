import { app, BrowserWindow, Tray, Menu, nativeImage, nativeTheme, ipcMain, Notification, utilityProcess, UtilityProcess, session, screen } from 'electron';
import path from 'path';
import net from 'net';

const isDev = !app.isPackaged;
const DEV_PORT = 23000;

// 시스템 테마와 관계없이 항상 Light 모드 강제
nativeTheme.themeSource = 'light';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let nextServer: UtilityProcess | null = null;
let isQuitting = false;

// 커스텀 알림 윈도우 스택 관리
const activeNotifications: BrowserWindow[] = [];
// 같은 방 알림 대체용: roomId → { win, autoCloseTimer, cleanup }
const activeNotifByRoom = new Map<string, {
  win: BrowserWindow;
  autoCloseTimer: ReturnType<typeof setTimeout>;
  cleanup: () => void;
}>();
let cachedAppIconDataUrl: string | null = null;
// macOS 네이티브 알림 추적: roomId → Notification[] (클릭 시 같은 방 알림 일괄 닫기)
const activeNativeNotifByRoom = new Map<string, Notification[]>();

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

function getNotificationPreloadPath() {
  return path.join(__dirname, 'notification-preload.js');
}

function getNotificationHtmlPath() {
  // electron:compile 시 dist-electron/에 복사되므로 __dirname 기준으로 통일
  return path.join(__dirname, 'notification.html');
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

function getDefaultProfilePath() {
  const base = isDev
    ? path.join(app.getAppPath(), 'resources')
    : process.resourcesPath;
  return path.join(base, 'notification-profile-default.png');
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

  mainWindow.on('focus', () => {
    mainWindow?.flashFrame(false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

}

// ------------------------------------------------------------------
// SVG → PNG 변환 (nativeImage는 SVG 미지원)
// ------------------------------------------------------------------

function svgToPngImage(svgBuffer: Buffer, size: number): Promise<Electron.NativeImage> {
  return new Promise((resolve) => {
    const base64 = svgBuffer.toString('base64');
    const html = `<html><body style="margin:0;background:transparent;">
      <img id="img" src="data:image/svg+xml;base64,${base64}" width="${size}" height="${size}" />
    </body></html>`;

    const win = new BrowserWindow({
      width: size,
      height: size,
      show: false,
      frame: false,
      transparent: true,
      webPreferences: { offscreen: true },
    });

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    win.webContents.on('paint', () => {
      // 렌더링 완료 후 캡처
      win.webContents.capturePage().then((img) => {
        win.close();
        resolve(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: size, height: size }));
      }).catch(() => {
        win.close();
        resolve(nativeImage.createEmpty());
      });
    });

    // 3초 타임아웃
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.close();
        resolve(nativeImage.createEmpty());
      }
    }, 3000);
  });
}

// ------------------------------------------------------------------
// Custom Notification (카카오톡 스타일)
// ------------------------------------------------------------------

const NOTIF_WIDTH = 360;
const NOTIF_HEIGHT = 120;
const NOTIF_GAP = 8;
const NOTIF_AUTO_CLOSE_MS = 5000;
let notifIdCounter = 0;


function repositionNotifications() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  activeNotifications.forEach((win, index) => {
    if (win.isDestroyed()) return;
    const x = width - NOTIF_WIDTH - 16;
    const y = height - (NOTIF_HEIGHT + NOTIF_GAP) * (index + 1);
    win.setPosition(x, y, false);
  });
}

function removeNotification(win: BrowserWindow) {
  const idx = activeNotifications.indexOf(win);
  if (idx >= 0) activeNotifications.splice(idx, 1);
  if (!win.isDestroyed()) win.close();
  repositionNotifications();
}

async function showCustomNotification(data: {
  title: string;
  body: string;
  profileImageUrl?: string;
  meta?: { roomId: string; channelType: string; senderName: string };
}) {
  // 프로필 이미지를 main process에서 미리 다운로드 → base64 data URI로 변환
  let profileDataUrl: string | undefined;
  if (data.profileImageUrl) {
    try {
      const res = await fetch(data.profileImageUrl);
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get('content-type') || 'image/png';
      profileDataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
    } catch {
      // 다운로드 실패 → 아래에서 기본 이미지 적용
    }
  }
  if (!profileDataUrl) {
    try {
      const defaultIcon = nativeImage.createFromPath(getDefaultProfilePath());
      profileDataUrl = defaultIcon.toDataURL();
    } catch {
      // 기본 이미지 파일도 없으면 HTML 측 폴백 사용
    }
  }

  // 앱 아이콘 캐싱 (최초 1회만 파일 읽기)
  if (!cachedAppIconDataUrl) {
    try {
      const appIcon = nativeImage.createFromPath(getIconPath()).resize({ width: 32, height: 32 });
      cachedAppIconDataUrl = appIcon.toDataURL();
    } catch {
      // 아이콘 로드 실패 시 HTML 폴백 사용
    }
  }

  const roomId = data.meta?.roomId;

  // ── 같은 방의 알림이 이미 떠있으면 → 내용만 교체 + 타이머 리셋 ──
  if (roomId) {
    const existing = activeNotifByRoom.get(roomId);
    if (existing && !existing.win.isDestroyed()) {
      existing.cleanup();
      clearTimeout(existing.autoCloseTimer);

      const newNotifId = ++notifIdCounter;
      const clickCh = `notification-click-${newNotifId}`;
      const closeCh = `notification-close-${newNotifId}`;
      const readCh = `notification-read-${newNotifId}`;

      // HTML에 새 내용 전송 (notifId도 갱신 → preload가 새 IPC 채널 사용)
      existing.win.webContents.send('notification-data', {
        title: data.title,
        body: data.body,
        profileImageUrl: profileDataUrl,
        appIconUrl: cachedAppIconDataUrl,
        notifId: newNotifId,
      });

      const cleanup = () => {
        ipcMain.removeListener(clickCh, onClickReplace);
        ipcMain.removeListener(closeCh, onCloseReplace);
        ipcMain.removeListener(readCh, onReadReplace);
      };

      const onClickReplace = () => {
        cleanup();
        clearTimeout(timer);
        removeNotification(existing.win);
        activeNotifByRoom.delete(roomId);
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          if (data.meta) mainWindow.webContents.send('notification-clicked', data.meta);
        }
      };

      const onCloseReplace = () => {
        cleanup();
        clearTimeout(timer);
        removeNotification(existing.win);
        activeNotifByRoom.delete(roomId);
      };

      const onReadReplace = () => {
        cleanup();
        clearTimeout(timer);
        removeNotification(existing.win);
        activeNotifByRoom.delete(roomId);
        if (mainWindow && data.meta) mainWindow.webContents.send('notification-read', data.meta);
      };

      ipcMain.once(clickCh, onClickReplace);
      ipcMain.once(closeCh, onCloseReplace);
      ipcMain.once(readCh, onReadReplace);

      const timer = setTimeout(() => {
        cleanup();
        removeNotification(existing.win);
        activeNotifByRoom.delete(roomId);
      }, NOTIF_AUTO_CLOSE_MS);

      activeNotifByRoom.set(roomId, { win: existing.win, autoCloseTimer: timer, cleanup });
      return;
    }
  }

  // ── 새 알림 윈도우 생성 ──
  const notifId = ++notifIdCounter;
  const clickChannel = `notification-click-${notifId}`;
  const closeChannel = `notification-close-${notifId}`;
  const readChannel = `notification-read-${notifId}`;

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const yIndex = activeNotifications.length;

  const notifWin = new BrowserWindow({
    width: NOTIF_WIDTH,
    height: NOTIF_HEIGHT,
    x: width - NOTIF_WIDTH - 16,
    y: height - (NOTIF_HEIGHT + NOTIF_GAP) * (yIndex + 1),
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    transparent: true,
    hasShadow: false,
    webPreferences: {
      preload: getNotificationPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  activeNotifications.push(notifWin);
  notifWin.loadFile(getNotificationHtmlPath());

  notifWin.once('ready-to-show', () => {
    if (notifWin.isDestroyed()) return;
    notifWin.showInactive();
    notifWin.webContents.send('notification-data', {
      title: data.title,
      body: data.body,
      profileImageUrl: profileDataUrl,
      appIconUrl: cachedAppIconDataUrl,
      notifId,
    });
  });

  const cleanup = () => {
    ipcMain.removeListener(clickChannel, onNotifClick);
    ipcMain.removeListener(closeChannel, onNotifClose);
    ipcMain.removeListener(readChannel, onNotifRead);
  };

  const onNotifClick = () => {
    cleanup();
    clearTimeout(autoCloseTimer);
    removeNotification(notifWin);
    if (roomId) activeNotifByRoom.delete(roomId);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (data.meta) mainWindow.webContents.send('notification-clicked', data.meta);
    }
  };

  const onNotifClose = () => {
    cleanup();
    clearTimeout(autoCloseTimer);
    removeNotification(notifWin);
    if (roomId) activeNotifByRoom.delete(roomId);
  };

  const onNotifRead = () => {
    cleanup();
    clearTimeout(autoCloseTimer);
    removeNotification(notifWin);
    if (roomId) activeNotifByRoom.delete(roomId);
    if (mainWindow && data.meta) mainWindow.webContents.send('notification-read', data.meta);
  };

  ipcMain.once(clickChannel, onNotifClick);
  ipcMain.once(closeChannel, onNotifClose);
  ipcMain.once(readChannel, onNotifRead);

  const autoCloseTimer = setTimeout(() => {
    cleanup();
    removeNotification(notifWin);
    if (roomId) activeNotifByRoom.delete(roomId);
  }, NOTIF_AUTO_CLOSE_MS);

  // roomId가 있으면 방별 알림 추적 시작
  if (roomId) {
    activeNotifByRoom.set(roomId, { win: notifWin, autoCloseTimer, cleanup });
  }

  // 윈도우가 닫힐 때 최신 cleanup 실행 (내용 교체 후에도 안전)
  notifWin.on('closed', () => {
    if (roomId) {
      const entry = activeNotifByRoom.get(roomId);
      if (entry?.win === notifWin) {
        entry.cleanup();
        clearTimeout(entry.autoCloseTimer);
        activeNotifByRoom.delete(roomId);
      }
    }
    const idx = activeNotifications.indexOf(notifWin);
    if (idx >= 0) activeNotifications.splice(idx, 1);
    repositionNotifications();
  });
}

// ------------------------------------------------------------------
// Native Notification (macOS)
// ------------------------------------------------------------------

async function showNativeNotification(data: {
  title: string;
  body: string;
  profileImageUrl?: string;
  meta?: { roomId: string; channelType: string; senderName: string };
}) {
  // 프로필 이미지 다운로드 → nativeImage 변환 (실패 시 기본 프로필 이미지 사용)
  const ICON_SIZE = 128;
  let icon: Electron.NativeImage | undefined;
  if (data.profileImageUrl) {
    try {
      const res = await fetch(data.profileImageUrl);
      const contentType = res.headers.get('content-type') || '';
      const buffer = Buffer.from(await res.arrayBuffer());

      if (contentType.includes('svg')) {
        // SVG → PNG 변환 (nativeImage는 SVG 미지원)
        icon = await svgToPngImage(buffer, ICON_SIZE);
      } else {
        icon = nativeImage.createFromBuffer(buffer).resize({ width: ICON_SIZE, height: ICON_SIZE });
      }
    } catch {
      // 다운로드 실패 → 기본 이미지로 폴백
    }
  }
  if (!icon || icon.isEmpty()) {
    icon = nativeImage.createFromPath(getDefaultProfilePath());
  }

  const roomId = data.meta?.roomId;

  const notif = new Notification({
    title: data.title,
    body: data.body,
    icon,
    actions: [{ type: 'button', text: '읽음' }],
  });

  // 같은 방의 모든 알림을 알림 센터에서 일괄 제거
  const closeAllForRoom = () => {
    if (!roomId) return;
    const group = activeNativeNotifByRoom.get(roomId);
    if (!group) return;
    // 먼저 Map에서 제거 → close 이벤트의 removeSelf()가 no-op이 됨
    activeNativeNotifByRoom.delete(roomId);
    // 복사본으로 순회 (close → removeSelf가 원본을 변경해도 영향 없음)
    for (const n of [...group]) {
      try { n.close(); } catch { /* 이미 닫힌 알림 무시 */ }
    }
  };

  // 추적 Map에서 이 알림만 제거
  const removeSelf = () => {
    if (!roomId) return;
    const group = activeNativeNotifByRoom.get(roomId);
    if (!group) return;
    const idx = group.indexOf(notif);
    if (idx >= 0) group.splice(idx, 1);
    if (group.length === 0) activeNativeNotifByRoom.delete(roomId);
  };

  notif.on('click', () => {
    closeAllForRoom(); // 같은 방 알림 전부 닫기
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (data.meta) {
        mainWindow.webContents.send('notification-clicked', data.meta);
      }
    }
  });

  notif.on('action', (_event, index) => {
    // 읽음 버튼 (index 0)
    if (index === 0) {
      closeAllForRoom(); // 같은 방 알림 전부 닫기
      if (mainWindow && data.meta) {
        mainWindow.webContents.send('notification-read', data.meta);
      }
    }
  });

  notif.on('close', () => {
    removeSelf(); // 개별 닫힘 시 자기만 제거
  });

  notif.show();

  // 추적 Map에 등록
  if (roomId) {
    const group = activeNativeNotifByRoom.get(roomId) ?? [];
    group.push(notif);
    activeNativeNotifByRoom.set(roomId, group);
  }
}

// ------------------------------------------------------------------
// Tray
// ------------------------------------------------------------------

let trayIsLoggedIn = false;
let trayIsLocked = false;

function updateTrayMenu(isLoggedIn: boolean, isLocked: boolean) {
  if (!tray) return;

  trayIsLoggedIn = isLoggedIn;
  trayIsLocked = isLocked;

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
      enabled: isLoggedIn && !isLocked,
      click: () => {
        mainWindow?.webContents.send('tray-lock-mode');
        mainWindow?.show();
      },
    },
    { type: 'separator' },
    {
      label: '로그아웃',
      enabled: isLoggedIn,
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
    { type: 'separator' },
    {
      label: '개발자 도구',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.toggleDevTools();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

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
  updateTrayMenu(false, false);

  if (process.platform !== 'darwin') {
    tray.on('double-click', () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
  }
}

// ------------------------------------------------------------------
// IPC Handlers
// ------------------------------------------------------------------

ipcMain.handle('show-notification', async (_event, data: {
  title: string;
  body: string;
  profileImageUrl?: string;
  meta?: { roomId: string; channelType: string; senderName: string };
}) => {
  if (process.platform === 'win32') {
    // Windows: 커스텀 알림 윈도우 (읽음 버튼 + 같은 방 대체)
    showCustomNotification(data);
  } else {
    // macOS: 시스템 네이티브 알림
    showNativeNotification(data);
  }

  // Windows만: 앱이 포커스되지 않은 상태면 작업 표시줄 주황 하이라이트
  if (process.platform === 'win32' && mainWindow && !mainWindow.isFocused()) {
    mainWindow.flashFrame(true);
  }
});

ipcMain.handle('focus-window', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('set-badge-count', (_event, count: number) => {
  if (process.platform === 'darwin') {
    app.setBadgeCount(count);
  } else if (process.platform === 'win32' && mainWindow) {
    if (count > 0) {
      // 빨간 배지에 숫자를 그려서 오버레이 아이콘으로 사용
      const size = 16;
      const canvas = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#FF3B30"/>
          ${count <= 99
            ? `<text x="50%" y="50%" text-anchor="middle" dy=".36em"
                font-family="Arial" font-size="${count > 9 ? 9 : 11}" font-weight="bold" fill="white">
                ${count}
              </text>`
            : `<text x="50%" y="50%" text-anchor="middle" dy=".36em"
                font-family="Arial" font-size="8" font-weight="bold" fill="white">
                99+
              </text>`
          }
        </svg>`;
      const overlay = nativeImage.createFromBuffer(Buffer.from(canvas));
      mainWindow.setOverlayIcon(overlay, `${count}개의 읽지 않은 메시지`);
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  }
});

ipcMain.handle('set-tray-auth-state', (_event, isLoggedIn: boolean) => {
  updateTrayMenu(isLoggedIn, trayIsLocked);
});

ipcMain.handle('set-tray-lock-state', (_event, isLocked: boolean) => {
  updateTrayMenu(trayIsLoggedIn, isLocked);
});

ipcMain.handle('set-titlebar-dimmed', (_event, isDimmed: boolean) => {
  if (process.platform !== 'win32' || !mainWindow) return;
  mainWindow.setTitleBarOverlay(
    isDimmed
      ? { color: '#666666', symbolColor: '#ffffff' }
      : { color: '#ffffff', symbolColor: '#333333' },
  );
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

app.on('before-quit', async () => {
  isQuitting = true;

  // 자동로그인 OFF → localStorage에서 인증 정보 삭제
  // 재시작 시 Zustand가 복원할 데이터가 없으므로 로그인 페이지로 이동
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      await mainWindow.webContents.executeJavaScript(`
        if (localStorage.getItem('auto-login') !== 'true') {
          localStorage.removeItem('user-auth');
          document.cookie = 'has-auth=; max-age=0; path=/';
        }
      `);
    } catch {
      // 윈도우가 이미 닫힌 경우 무시
    }
  }
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
