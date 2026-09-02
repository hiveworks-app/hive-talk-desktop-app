import { BrowserWindow, app, ipcMain } from 'electron';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let autoUpdater: any = null;

/** electron-updater 로드 + 공통 설정 — 부팅 게이트/런타임 초기화가 공용. 실패 시 false */
function ensureUpdaterLoaded(): boolean {
  // Linux(deb)는 electron-updater 업데이트 채널이 없다 — 기동 시 오류 로그만 남으므로 스킵
  if (process.platform === 'linux') return false;
  if (autoUpdater) return true;
  try {
    // 동적 require: 모듈이 없어도 앱이 크래시하지 않음
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('electron-updater');
    autoUpdater = mod.autoUpdater;
  } catch (err) {
    console.error('[AutoUpdater] electron-updater 모듈 로드 실패:', err);
    return false;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  return true;
}

/**
 * 부팅 업데이트 게이트 (디스코드식, 2026-09-02) — 스플래시가 떠 있는 동안 새 버전을
 * 확인·다운로드하고, 받으면 그 자리에서 설치·재시작한다. 항상 최신 버전으로 진입.
 *
 * 부팅을 볼모로 잡지 않는 폴백:
 * - 체크 4초 무응답/오류/오프라인 → 정상 부팅 (런타임 배너 흐름이 이어받는다)
 * - 다운로드 60초 무진행 → 정상 부팅 (다운로드는 백그라운드 지속 — 완료 시 배너 안내)
 */
export async function runBootUpdateGate(opts: {
  setStatus: (text: string, percent?: number | null) => void;
  setIsQuitting: (v: boolean) => void;
}): Promise<'proceed' | 'restarting'> {
  if (!ensureUpdaterLoaded()) return 'proceed';

  return await new Promise(resolve => {
    let settled = false;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const checkTimer = setTimeout(() => finish('proceed'), 4_000);

    const finish = (result: 'proceed' | 'restarting') => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const armStallTimer = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => finish('proceed'), 60_000);
    };
    const onAvailable = (info: { version: string }) => {
      clearTimeout(checkTimer);
      console.log('[AutoUpdater] 부팅 게이트 — 새 버전 발견:', info.version);
      opts.setStatus(`새 버전(v${info.version}) 다운로드 중…`, 0);
      armStallTimer();
    };
    const onNotAvailable = () => finish('proceed');
    const onProgress = (p: { percent: number }) => {
      const pct = Math.round(p.percent);
      opts.setStatus(`새 버전 다운로드 중… ${pct}%`, pct);
      armStallTimer();
    };
    const onDownloaded = (info: { version: string }) => {
      console.log('[AutoUpdater] 부팅 게이트 — 다운로드 완료, 즉시 설치:', info.version);
      opts.setStatus('업데이트를 적용하고 다시 시작합니다', 100);
      opts.setIsQuitting(true);
      settled = true;
      cleanup();
      // 스플래시가 문구를 그릴 짧은 여유 후 설치 (NSIS 진행 창 → 새 버전 재실행)
      setTimeout(() => autoUpdater.quitAndInstall(false, true), 400);
      resolve('restarting');
    };
    const onError = (err: Error) => {
      console.warn('[AutoUpdater] 부팅 게이트 오류 → 정상 부팅:', err.message);
      finish('proceed');
    };
    const cleanup = () => {
      clearTimeout(checkTimer);
      if (stallTimer) clearTimeout(stallTimer);
      autoUpdater.removeListener('update-available', onAvailable);
      autoUpdater.removeListener('update-not-available', onNotAvailable);
      autoUpdater.removeListener('download-progress', onProgress);
      autoUpdater.removeListener('update-downloaded', onDownloaded);
      autoUpdater.removeListener('error', onError);
    };

    autoUpdater.on('update-available', onAvailable);
    autoUpdater.on('update-not-available', onNotAvailable);
    autoUpdater.on('download-progress', onProgress);
    autoUpdater.on('update-downloaded', onDownloaded);
    autoUpdater.on('error', onError);

    opts.setStatus('업데이트 확인 중…');
    autoUpdater.checkForUpdates().catch(() => finish('proceed'));
  });
}

export function initializeAutoUpdater(deps: {
  getMainWindow: () => BrowserWindow | null;
  setIsQuitting: (v: boolean) => void;
}) {
  if (!ensureUpdaterLoaded()) {
    console.log('[AutoUpdater] 초기화 생략 (Linux 또는 모듈 로드 실패)');
    return;
  }

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
  ipcMain.handle('check-for-updates', async (): Promise<{ status: 'available' | 'up-to-date' | 'unsupported' | 'error'; version?: string }> => {
    // Linux(deb)는 업데이트 채널 자체가 없다 — 렌더러가 "릴리즈 페이지에서 재설치" 안내
    if (process.platform === 'linux') return { status: 'unsupported' };
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
      // isSilent: false — 교체 구간(앱 종료~재실행)에 NSIS 진행 창을 띄운다 (2026-09-02 최종 결정).
      // 한 바퀴 돈 결정: silent로 바꿨더니 빈 공백이 "앱이 죽었다"로 읽혔다. 렌더러의
      // "적용 중" 예고(useAutoUpdate)와 조합하면 진행 창이 그 구간의 스플래시 역할을 한다.
      // 윈도우는 실행 중 exe를 교체할 수 없어 종료→교체→재실행 자체는 생략 불가.
      autoUpdater.quitAndInstall(false, true);
    }, 100);
  });
}
