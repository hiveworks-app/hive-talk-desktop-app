import { BrowserWindow, app, ipcMain } from 'electron';

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
}

/** IPC: 수동 업데이트 확인 (설정 > 앱 버전 행) — RN AppVersionScreen의 스토어 버전 조회 대응.
 *  initializeAutoUpdater는 패키징 빌드에서만 돌지만 렌더러는 항상 invoke할 수 있으므로
 *  핸들러는 무조건 등록한다 (미등록 시 'No handler registered' 에러가 콘솔로 샌다). */
export function registerUpdateIpc(deps: { setIsQuitting: (v: boolean) => void }) {
  ipcMain.handle('check-for-updates', async (): Promise<{ status: 'available' | 'up-to-date' | 'error'; version?: string }> => {
    // 개발 실행(비패키징)은 업데이트 채널이 없다 — 에러가 아니라 '최신'으로 안내.
    // 패키징인데 updater가 없으면(모듈 로드 실패) 실제 오류로 취급.
    if (!autoUpdater) return app.isPackaged ? { status: 'error' } : { status: 'up-to-date' };
    try {
      const result = await autoUpdater.checkForUpdates();
      const latest: string | undefined = result?.updateInfo?.version;
      if (!latest) return { status: 'up-to-date' };
      // 단순 세그먼트 숫자 비교 — 서버가 더 높은 버전일 때만 available
      const cur = app.getVersion().split('.').map(Number);
      const next = latest.split('.').map(Number);
      for (let i = 0; i < Math.max(cur.length, next.length); i++) {
        const a = next[i] ?? 0;
        const b = cur[i] ?? 0;
        if (a > b) return { status: 'available', version: latest };
        if (a < b) return { status: 'up-to-date' };
      }
      return { status: 'up-to-date' };
    } catch (err) {
      console.error('[AutoUpdater] 수동 업데이트 확인 실패:', err);
      return { status: 'error' };
    }
  });

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
