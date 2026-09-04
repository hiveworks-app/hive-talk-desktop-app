import path from 'path';
import { app, BrowserWindow, ipcMain } from 'electron';

/** 딥링크 커스텀 스킴 — 메일 '앱에서 인증 완료하기' 등 외부 → 앱 진입 (2026-09-03).
 *  데스크톱 OS에는 https를 앱으로 라우팅하는 표준(모바일 App/Universal Link)이 없어
 *  랜딩 페이지가 이 스킴을 호출하는 방식이 관례다 (slack:// discord:// 동일). */
export const DEEP_LINK_SCHEME = 'hivetalk';

let pendingUrl: string | null = null;
let rendererReady = false;
let getWindow: (() => BrowserWindow | null) | null = null;

/** OS에 스킴 소유자로 등록 — 모듈 로드 시점(whenReady 이전) 호출 */
export function registerDeepLinkScheme() {
  // dev(비패키징)는 실행 파일 + 스크립트 경로를 함께 등록해야 OS가 dev 앱을 가리킨다
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
  }
}

/** 윈도우/리눅스 — 딥링크는 프로세스 인자(argv)로 도착한다 (첫 실행·second-instance 공용) */
export function extractDeepLinkUrl(argv: string[]): string | null {
  return argv.find(arg => arg.startsWith(`${DEEP_LINK_SCHEME}://`)) ?? null;
}

/** 수신 URL 큐잉 + 창 전면화 — 렌더러 준비 전(콜드 스타트)에는 보관했다가 ready 시 전달.
 *  연달아 오면 최신 1건만 유지 (인증 링크 특성상 마지막 것이 유효) */
export function handleDeepLinkUrl(url: string) {
  pendingUrl = url;
  const win = getWindow?.();
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
  flush();
}

function flush() {
  if (!rendererReady || !pendingUrl) return;
  const win = getWindow?.();
  if (!win || win.isDestroyed()) return;
  win.webContents.send('deep-link', pendingUrl);
  pendingUrl = null;
}

/** main 배선: 창 참조 연결 + 렌더러 준비 핸드셰이크 등록.
 *  렌더러의 DeepLinkHandler가 마운트되며 'deep-link-ready'를 보내는 시점이
 *  "URL을 처리할 수 있게 된 순간" — 그 전에 도착한 URL은 여기서 큐로 버틴다. */
export function initDeepLink(getMainWindow: () => BrowserWindow | null) {
  getWindow = getMainWindow;
  ipcMain.on('deep-link-ready', () => {
    rendererReady = true;
    flush();
  });
}
