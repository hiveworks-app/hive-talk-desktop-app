import { BrowserWindow, ipcMain } from 'electron';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let autoUpdater: any = null;

export function initializeAutoUpdater(deps: {
  getMainWindow: () => BrowserWindow | null;
  setIsQuitting: (v: boolean) => void;
}) {
  try {
    // 동적 require: 모듈이 없어도 앱이 크래시하지 않음
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('electron-updater');
    autoUpdater = mod.autoUpdater;
  } catch (err) {
    console.error('[AutoUpdater] electron-updater 모듈 로드 실패:', err);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', (info: { version: string }) => {
    console.log('[AutoUpdater] Update available:', info.version);
    deps.getMainWindow()?.webContents.send('update-available', { version: info.version });
  });

  autoUpdater.on('update-downloaded', (info: { version: string }) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    deps.getMainWindow()?.webContents.send('update-downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('[AutoUpdater] Error:', err.message);
  });

  autoUpdater.checkForUpdatesAndNotify();

  // IPC: 재시작 버튼
  ipcMain.handle('install-update', () => {
    if (!autoUpdater) {
      console.error('[AutoUpdater] autoUpdater가 초기화되지 않음');
      return;
    }
    console.log('[AutoUpdater] quitAndInstall 호출');
    deps.setIsQuitting(true);
    // IPC 응답이 렌더러로 전달된 후 종료 (즉시 종료하면 IPC가 블로킹됨)
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 100);
  });
}
