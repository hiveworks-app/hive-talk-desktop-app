import { app, BrowserWindow, Menu, nativeTheme, Tray } from 'electron';
import { startNextServer, killNextServer } from './server';
import { createWindow } from './window';
import { createTray } from './tray';
import { setupIpcHandlers } from './ipc';
import { initializeAutoUpdater } from './autoUpdater';

// 시스템 테마와 관계없이 항상 Light 모드 강제
nativeTheme.themeSource = 'light';

// ------------------------------------------------------------------
// Shared State
// ------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const deps = {
  getMainWindow: () => mainWindow,
  getTray: () => tray,
  getIsQuitting: () => isQuitting,
  setIsQuitting: (v: boolean) => { isQuitting = v; },
};

// ------------------------------------------------------------------
// Single Instance Lock
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// App Lifecycle
// ------------------------------------------------------------------

app.on('before-quit', async () => {
  isQuitting = true;

  // 자동로그인 OFF → localStorage에서 인증 정보 삭제
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
  killNextServer();
});

// ------------------------------------------------------------------
// App Ready
// ------------------------------------------------------------------

app.whenReady().then(async () => {
  app.setName('HiveTalk');

  // macOS 메뉴바
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
    mainWindow = createWindow(serverUrl, deps);
    tray = createTray(deps);
    setupIpcHandlers(deps);

    mainWindow.on('closed', () => { mainWindow = null; });

    // 자동 업데이트 (프로덕션에서만)
    if (app.isPackaged) {
      initializeAutoUpdater(deps);
    }
  } catch (err) {
    console.error('Failed to start:', err);
    app.quit();
  }
});
