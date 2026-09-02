import { app, BrowserWindow, dialog, Menu, nativeTheme, Tray } from 'electron';
import { initMainSentry } from './sentry';
import { startNextServer, killNextServer } from './server';
import { createSplashWindow, closeSplashWindow } from './splash';
import { createWindow } from './window';
import { createTray } from './tray';
import { setupIpcHandlers } from './ipc';
import { initializeAutoUpdater, registerUpdateIpc } from './autoUpdater';
import { isDev } from './utils';

// 앱 이름은 무엇보다 먼저 고정 — userData 경로(%APPDATA%/<이름>)가 여기서 결정된다.
// whenReady 안에서 늦게 부르면 싱글 인스턴스 락·Sentry·Chromium 프로필은 package.json
// 이름(hiveworks-web) 폴더를 쓰고, 이후 코드는 HiveTalk 폴더를 봐서 두 갈래로 갈라진다
// (window-state 저장이 존재하지 않는 HiveTalk 폴더에 쓰다 조용히 실패 — 2026-09-01 윈도우 실측)
app.setName('HiveTalk');

// Sentry는 가능한 한 이른 시점에 초기화 (이후 main 코드의 예외까지 수집)
initMainSentry();

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
    // 최소화 상태에서 바로가기 재실행 시 show()만으로는 윈도우에서 복원되지 않는다
    // (Electron second-instance 공식 예제와 focus-window IPC 핸들러의 동일 규칙)
    if (mainWindow.isMinimized()) mainWindow.restore();
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
          // 개발자 도구는 dev 전용 — 배포 빌드는 webPreferences.devTools:false로 원천 차단과 한 쌍
          ...(isDev ? [{ role: 'toggleDevTools' as const, label: '개발자 도구' }] : []),
          // 확대/축소(⌘+/−) 미제공 — 네이티브 데스크톱 앱처럼 고정 배율 (카톡 PC 관례)
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

  // 서버 부팅(느린 PC에서 수십 초) 동안 무반응으로 보이지 않게 즉시 스플래시부터 표시
  createSplashWindow();

  try {
    const serverUrl = await startNextServer();
    // 부팅 중 스플래시를 닫아 종료가 시작됐으면(quit → before-quit → isQuitting)
    // 뒤늦게 도착한 서버 준비로 창을 만들지 않는다
    if (isQuitting) return;
    mainWindow = createWindow(serverUrl, deps);
    // 메인 창이 실제 표시되는 순간(ready-to-show → show) 스플래시 제거 — 빈틈·겹침 없음
    mainWindow.once('show', () => closeSplashWindow());
    tray = createTray(deps);
    setupIpcHandlers(deps, serverUrl);

    mainWindow.on('closed', () => { mainWindow = null; });

    // 수동 업데이트 확인 IPC는 항상 등록 (개발 실행에서도 '최신' 응답으로 정상 동작)
    registerUpdateIpc(deps);
    // 자동 업데이트 (프로덕션에서만)
    if (app.isPackaged) {
      initializeAutoUpdater(deps);
    }
  } catch (err) {
    console.error('Failed to start:', err);
    // 스플래시만 떠 있다 침묵 종료되면 사용자는 원인을 알 수 없다 — 실패를 알리고 종료.
    // 서버 30초 타임아웃의 주 용의자는 보안 프로그램의 검사/차단 (2026-09-02 현장)
    closeSplashWindow();
    dialog.showErrorBox(
      'HiveTalk 실행 실패',
      '앱을 시작하지 못했습니다. 잠시 후 다시 실행해주세요.\n문제가 계속되면 보안 프로그램이 앱을 차단하고 있는지 확인해주세요.',
    );
    app.quit();
  }
});
