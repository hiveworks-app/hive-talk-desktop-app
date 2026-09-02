import { app, BrowserWindow } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import { isDev, getIconPath } from './utils';

let splash: BrowserWindow | null = null;
// 프로그램적 닫힘(메인 창 표시)과 사용자 닫힘(기동 중단) 구분
let dismissed = false;

// 스플래시 로고는 모든 플랫폼에서 png — 윈도우 앱 아이콘(getIconPath)은 ico라 별도
function getSplashIconUrl(): string {
  const base = isDev ? path.join(app.getAppPath(), 'resources') : process.resourcesPath;
  return pathToFileURL(path.join(base, 'icon.png')).href;
}

/** 기동 즉시 표시하는 스플래시 — Next 서버 부팅 동안 "클릭했는데 무반응"을 없앤다.
 *  백신 검사가 심한 PC에서 창 없이 20초 대기 실측(2026-09-02) — 서버 준비 후 메인 창이
 *  표시되는 순간(main.ts의 'show' 이벤트) closeSplashWindow로 제거된다. */
export function createSplashWindow(): void {
  dismissed = false;
  splash = new BrowserWindow({
    width: 300,
    height: 340,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'HiveTalk',
    icon: getIconPath(),
    backgroundColor: '#FFFFFF',
    show: false, // 페인트 완료 후 표시 (아래 ready-to-show)
    webPreferences: { devTools: false },
  });
  // 콘텐츠 페인트 후 표시 — 즉시 show하면 렌더러 기동 동안 빈 흰 박스로 보인다 (2026-09-02 윈도우 실측).
  // 페인트가 오래 걸리는 머신 대비 1.5초 후에는 상태 그대로라도 표시(안전망)
  const showFallback = setTimeout(() => {
    if (splash && !splash.isDestroyed() && !splash.isVisible()) splash.show();
  }, 1500);
  splash.once('ready-to-show', () => {
    clearTimeout(showFallback);
    if (splash && !splash.isDestroyed()) splash.show();
  });
  // 사용자가 스플래시를 직접 닫으면 기동 중단 — 창 없는 유령 부팅이 백그라운드에 남는 것 방지
  splash.on('closed', () => {
    clearTimeout(showFallback);
    splash = null;
    if (!dismissed) app.quit();
  });
  void splash.loadFile(path.join(__dirname, 'splash.html'), {
    query: { icon: getSplashIconUrl() },
  });
}

/** 메인 창이 실제로 표시되는 순간 호출 — 스플래시 제거 */
export function closeSplashWindow(): void {
  dismissed = true;
  if (splash && !splash.isDestroyed()) splash.close();
  splash = null;
}

/** 부팅 상태 문구 갱신 (디스코드식) — 업데이트 확인/다운로드 진행률을 스플래시에 표시.
 *  percent가 null이면 진행률 바 숨김. 스플래시가 이미 닫혔으면 조용히 무시. */
export function setSplashStatus(text: string, percent: number | null = null): void {
  if (!splash || splash.isDestroyed()) return;
  void splash.webContents
    .executeJavaScript(`window.__setBootStatus?.(${JSON.stringify(text)}, ${percent === null ? 'null' : percent});`)
    .catch(() => { /* 로드 전/닫힘 — 무시 */ });
}
