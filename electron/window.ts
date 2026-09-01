import { app, BrowserWindow, Menu, session, screen, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getPreloadPath, getIconPath, isDev } from './utils';

let escSuppressed = false;

export function setEscSuppressed(value: boolean) {
  escSuppressed = value;
}

/** 렌더러의 target=_blank 링크를 OS 기본 브라우저로 위임 — 주소창 없는 앱 창에 임의
 *  웹페이지가 로드되는 것을 막는다 (RN openLink 패리티, 2026-08-26 전수 감사).
 *  앱 자체 팝업(멀티 채팅창)은 window.open이 아니라 IPC로 열리므로 영향 없음. */
function delegateExternalLinks(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

/** 입력란 우클릭 시 네이티브 편집 메뉴 — Electron은 브라우저와 달리 기본 컨텍스트 메뉴가 없다.
 *  입력 가능한 요소(isEditable)로 한정 — 메시지 버블의 커스텀 우클릭 메뉴(태그/공지)와 이중 노출 방지.
 *  라벨은 macOS 앱 메뉴(main.ts '편집')와 동일 표기, 활성/비활성은 우클릭 시점의 editFlags를 따른다. */
function attachEditableContextMenu(win: BrowserWindow) {
  win.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable) return;
    const { editFlags } = params;
    const menu = Menu.buildFromTemplate([
      { role: 'undo', label: '실행 취소', enabled: editFlags.canUndo },
      { role: 'redo', label: '다시 실행', enabled: editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', label: '잘라내기', enabled: editFlags.canCut },
      { role: 'copy', label: '복사', enabled: editFlags.canCopy },
      { role: 'paste', label: '붙여넣기', enabled: editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', label: '전체 선택', enabled: editFlags.canSelectAll },
    ]);
    menu.popup({ window: win });
  });
}

/** 새로고침 단축키 (Ctrl+R / F5) — 윈도우·리눅스는 앱 메뉴가 없어 role 기반 단축키가 없다.
 *  화면이 꼬였을 때 사용자가 스스로 복구할 수단 (macOS는 앱 메뉴의 ⌘R이 별도로 있다). */
function attachReloadShortcut(win: BrowserWindow) {
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return;
    if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
      win.webContents.reload();
    }
  });
}

/** 기본 창 크기 — 창 크기는 앱이 임의로 바꾸지 않는다.
 *  채팅방 진입/이탈 자동 폭 조절(480↔960)은 제거됨 (사용자 결정 2026-08-21).
 *  첫 실행 기본 크기는 400×640 = 최소 크기와 동일 (사용자 결정 2026-09-01).
 *  사용자가 직접 조절한 크기·위치는 기억해 다음 실행에서 복원한다(아래 WindowState) —
 *  "앱이 임의로 바꾸지 않는다"와 상충하지 않는 사용자 주도 크기. */
export const WINDOW_WIDTH_DEFAULT = 400;
export const WINDOW_HEIGHT_DEFAULT = 640;

/* ─── 창 크기·위치 기억 (메인 창 전용) ───────────────────────────────
   종료·숨김 시 저장했다가 다음 실행에서 복원 (카톡 PC 관례). 첫 실행이나 파일 손상,
   저장된 위치가 현재 모니터 구성 밖이면 기본값으로 폴백한다. */
type WindowState = { x?: number; y?: number; width: number; height: number; isMaximized?: boolean };

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowState | null {
  try {
    const raw = JSON.parse(fs.readFileSync(getWindowStatePath(), 'utf8')) as unknown;
    if (typeof raw !== 'object' || raw === null) return null;
    const s = raw as Record<string, unknown>;
    if (typeof s.width !== 'number' || typeof s.height !== 'number') return null;
    return {
      width: s.width,
      height: s.height,
      x: typeof s.x === 'number' ? s.x : undefined,
      y: typeof s.y === 'number' ? s.y : undefined,
      isMaximized: s.isMaximized === true,
    };
  } catch {
    return null; // 첫 실행 또는 파일 손상 — 기본 크기 사용
  }
}

function saveWindowState(win: BrowserWindow) {
  try {
    // 최대화 상태면 getNormalBounds()가 최대화 이전 크기를 준다 — 해제 시 돌아갈 크기로 저장
    const state: WindowState = { ...win.getNormalBounds(), isMaximized: win.isMaximized() };
    const file = getWindowStatePath();
    // userData 폴더가 아직 없으면 writeFileSync가 ENOENT로 조용히 죽는다 — 항상 보장
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state));
  } catch { /* 저장 실패는 무해 — 다음 실행이 기본 크기로 뜰 뿐 */ }
}

/** 저장된 위치가 현재 연결된 모니터 작업영역과 일부라도 겹치는지 — 모니터 분리·해상도 변경 후
 *  화면 밖 유령 위치에 창이 뜨는 것을 방지 */
function isStateVisible(state: WindowState): boolean {
  if (state.x === undefined || state.y === undefined) return false;
  return screen.getAllDisplays().some(d => {
    const a = d.workArea;
    return (
      state.x! < a.x + a.width && state.x! + state.width > a.x &&
      state.y! < a.y + a.height && state.y! + state.height > a.y
    );
  });
}

// ─── 멀티 채팅창 (프로토타입 2026-08-21) ───
// 방별 팝업 창 레지스트리 — 같은 방은 새 창 대신 기존 창 포커스
const chatWindows = new Map<string, BrowserWindow>();

/** 채팅 목록 우클릭 '새 창에서 열기' — 대화 단독 팝업 창.
 *  경로는 팝업 전용 라우트(/chat-popup/{roomId}) — (main) 셸(네비·전역 안내·자동 업데이트)을 타지 않는다. */
export function openChatWindow(serverUrl: string, path: string, roomId: string) {
  const existing = chatWindows.get(roomId);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: Math.min(520, screenWidth),
    height: Math.min(720, screenHeight),
    minWidth: Math.min(400, screenWidth),
    minHeight: Math.min(480, screenHeight),
    title: 'HiveTalk',
    icon: getIconPath(),
    // 콘텐츠 준비 전 빈 창이 깜빡이지 않도록 숨겨서 만들고 ready-to-show에서 표시 (메인 창과 동일 패턴).
    // backgroundColor는 첫 페인트 전 기본 흰 배경 대신 앱 배경색을 쓰게 한다.
    show: false,
    backgroundColor: '#FFFFFF',
    // 팝업은 OS 기본 타이틀바 사용 (메인 창의 hiddenInset·드래그 바 체계와 분리)
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      // 배포 빌드에서 개발자 도구 원천 차단 — 메뉴·단축키·프로그램 호출 등 모든 경로 무력화
      devTools: isDev,
    },
  });
  delegateExternalLinks(win);
  attachEditableContextMenu(win);
  attachReloadShortcut(win);
  // dev에서 라우트 온디맨드 컴파일이 길어지면 ready-to-show가 늦게 와 창이 안 뜬 것처럼 보인다 —
  // 일정 시간 뒤에는 스피너 상태로라도 표시하는 안전망 (프로덕션은 ready-to-show가 먼저 도착).
  const showFallback = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) win.show();
  }, 1200);
  win.once('ready-to-show', () => {
    clearTimeout(showFallback);
    win.show();
  });
  // 고정 배율(100%) 강제 — 줌은 origin별로 세션에 영구 저장되므로(createWindow와 동일 이유) 팝업도 항상 초기화
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(1);
  });
  // 팝업은 트레이 최소화 없이 그냥 닫힘 (메인 창 전용 동작 미적용)
  win.on('closed', () => {
    clearTimeout(showFallback);
    chatWindows.delete(roomId);
  });
  void win.loadURL(`${serverUrl}${path}`);
  chatWindows.set(roomId, win);
}

/** 열려 있는 모든 팝업 창에 IPC 이벤트를 보낸다 (WS 중계용) */
export function broadcastToChatWindows(channel: string, payload: unknown) {
  chatWindows.forEach(win => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  });
}

/** 앱 종료/로그아웃 시 팝업 정리 — 팝업은 허브(메인 창)의 소켓에 의존하므로 혼자 남으면 죽은 창이 된다 */
/** 특정 방의 팝업 창 닫기 — 방 관리 일괄 나가기 등에서 나간 방의 유령 창 방지 */
export function closeChatWindow(roomId: string) {
  const win = chatWindows.get(roomId);
  if (win && !win.isDestroyed()) win.close();
  chatWindows.delete(roomId);
}

export function closeAllChatWindows() {
  chatWindows.forEach(win => {
    if (!win.isDestroyed()) win.close();
  });
  chatWindows.clear();
}

export function createWindow(
  serverUrl: string,
  deps: { getIsQuitting: () => boolean },
): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  // 지난 실행에서 저장된 크기·위치 복원 (위치는 현재 모니터 안에 보일 때만)
  const saved = loadWindowState();
  const savedPosition = saved && isStateVisible(saved) ? { x: saved.x, y: saved.y } : {};

  const win = new BrowserWindow({
    // 작은 디스플레이에서 화면보다 커지지 않도록 작업영역으로 클램프.
    width: Math.max(400, Math.min(saved?.width ?? WINDOW_WIDTH_DEFAULT, screenWidth)),
    height: Math.max(640, Math.min(saved?.height ?? WINDOW_HEIGHT_DEFAULT, screenHeight)),
    ...savedPosition,
    minWidth: Math.min(400, screenWidth),
    minHeight: Math.min(640, screenHeight),
    maxWidth: screenWidth,
    maxHeight: screenHeight,
    title: 'HiveTalk',
    icon: getIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      // 배포 빌드에서 개발자 도구 원천 차단 — 메뉴·단축키·프로그램 호출 등 모든 경로 무력화
      devTools: isDev,
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
  delegateExternalLinks(win);
  attachEditableContextMenu(win);
  attachReloadShortcut(win);

  // 요청 Origin 제거: 데스크톱은 내장 서버(localhost:23000, 점유 시 랜덤 포트)에서 UI를 띄우므로
  // 브라우저 엔진이 모든 API 요청에 Origin: http://localhost:<port> 를 자동으로 붙인다.
  // 실서버는 이 출처가 CORS 허용 목록에 없어 문전 403으로 차단하므로(2026-08-31 실측:
  // Origin 없으면 400 정상 도달, 붙이면 403), 모바일(RN)과 동일한 "Origin 없는 네이티브
  // 클라이언트"로 요청한다. CORS는 브라우저-사용자 보호 장치라 자체 앱 요청에서 제거해도
  // 서버 공격면은 변하지 않으며, 랜덤 포트 폴백 시 출처가 바뀌는 문제도 함께 해소된다.
  // wss 패턴 별도 명시: match pattern의 `*://`는 http/https만 매칭 — WS 핸드셰이크도 커버.
  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        '*://*.hiveworks.co.kr/*',
        '*://hiveworks.co.kr/*',
        '*://*.ncloudstorage.com/*',
        'wss://*.hiveworks.co.kr/*',
        'wss://hiveworks.co.kr/*',
      ],
    },
    (details, callback) => {
      const requestHeaders = { ...details.requestHeaders };
      for (const key of Object.keys(requestHeaders)) {
        if (key.toLowerCase() === 'origin') delete requestHeaders[key];
      }
      callback({ requestHeaders });
    },
  );

  // CORS 우회: API 서버 + NCloud Object Storage 도메인에 대해 CORS 헤더 재설정
  // URL 필터를 사용하여 localhost 페이지/에셋 로딩에 영향을 주지 않음
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['*://*.hiveworks.co.kr/*', '*://hiveworks.co.kr/*', '*://*.ncloudstorage.com/*'] },
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

  // 고정 배율(100%) 강제 — Electron은 setZoomFactor로 설정된 줌을 origin별로
  // 세션 데이터에 영구 저장하므로, 과거에 저장된 배율이 남아 있어도 항상 100%로 초기화한다.
  // (확대/축소 기능 자체를 제공하지 않는 앱 — 카톡 PC와 동일한 고정 크기 정책)
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(1);
  });

  // 지난 종료가 최대화 상태였으면 그대로 복원 (표시 전에 걸어두면 최대화된 채로 뜬다)
  if (saved?.isMaximized) win.maximize();

  win.once('ready-to-show', () => {
    win.show();
  });

  // Close → tray (채팅앱이므로 트레이 최소화)
  win.on('close', (e) => {
    // 숨김·실제 종료 양쪽 경로 모두 이 이벤트를 지나므로 여기서 크기·위치 저장
    saveWindowState(win);
    if (!deps.getIsQuitting()) {
      e.preventDefault();
      win.hide();
    }
  });

  win.on('focus', () => {
    win.flashFrame(false);
  });

  // ESC 키 → 창 숨기기 (트레이로 최소화, overlay가 열려있으면 무시)
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown' && !input.alt && !input.control && !input.meta && !escSuppressed) {
      win.hide();
    }
  });

  return win;
}
