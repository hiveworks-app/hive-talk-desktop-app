import { app, BrowserWindow, dialog, ipcMain, nativeImage, session, Tray } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getTrayIconPath, getTrayBadgeIconPath } from './utils';
import { getRoundedTrayIcon, getRoundedTrayBadgeIcon } from './trayIcon';
import { showCustomNotification, showNativeNotification, NotificationData } from './notifications';
import { updateTrayMenu, getTrayAuthState } from './tray';
import { setEscSuppressed, openChatWindow, broadcastToChatWindows, closeAllChatWindows, closeChatWindow } from './window';

/* ─── 일괄 다운로드 (사이드패널 보관함) ─────────────────────────────
   렌더러의 <a download> 연쇄 클릭은 크로미엄 DownloadRequestLimiter가 '자동 다운로드'로
   판정해 첫 건 이후를 조용히 버린다(에러도 없음). 일괄은 main이 downloadURL로 받아
   OS 다운로드 폴더에 조용히 저장한다. pendingDownloads에 등록된 URL만 여기서 처리하고
   단건 <a download>는 기존 동작(저장 다이얼로그)을 유지한다. */
const pendingDownloads = new Map<
  string,
  { filename: string; directory?: string; resolve: (ok: boolean) => void }
>();

/* ─── 작업 표시줄 안읽음 배지 (Windows) ─────────────────────────────
   맥 dock 배지의 윈도우 대응물 — setOverlayIcon으로 아이콘 우하단에 빨간 점을 얹는다
   (숫자 없이 점만, 사용자 결정 2026-09-01). 색은 트레이 점과 동일한 #FF3B30.
   주의: 오버레이는 캔버스 전체가 고정 슬롯(약 16px)에 스케일되어 그려진다 — 구석에 작은
   점만 그리면 반점처럼 찌그러진다(실측 2026-09-01). Teams식으로 32px 캔버스 중앙에
   비례 큰 점(20px)을 그려 화면에서 ~10px 원이 되게 한다 (다운스케일이라 경계도 깔끔).
   원시 버퍼는 BGRA 순서 + 프리멀티플라이드 알파(색상값×알파) — 경계 1px 안티앨리어싱. */
let unreadOverlayIcon: Electron.NativeImage | null = null;
function getUnreadOverlayIcon(): Electron.NativeImage {
  if (unreadOverlayIcon) return unreadOverlayIcon;
  const size = 32;
  const buf = Buffer.alloc(size * size * 4); // 투명 배경
  const radius = 10;
  const center = (size - 1) / 2; // 중앙 정렬 — 슬롯 안에서 원이 통째로 보인다
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const alpha = Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(x - center, y - center)));
      if (alpha === 0) continue;
      const offset = (y * size + x) * 4;
      buf[offset] = Math.round(0x30 * alpha);     // B
      buf[offset + 1] = Math.round(0x3b * alpha); // G
      buf[offset + 2] = Math.round(0xff * alpha); // R
      buf[offset + 3] = Math.round(255 * alpha);
    }
  }
  unreadOverlayIcon = nativeImage.createFromBuffer(buf, { width: size, height: size });
  return unreadOverlayIcon;
}

/** "이름 (1).ext" 식으로 중복을 피한 저장 경로 */
function uniqueSavePath(dir: string, filename: string): string {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = path.join(dir, filename);
  for (let i = 1; fs.existsSync(candidate); i++) {
    candidate = path.join(dir, `${base} (${i})${ext}`);
  }
  return candidate;
}

export function setupIpcHandlers(
  deps: {
    getMainWindow: () => BrowserWindow | null;
    getTray: () => Tray | null;
    setIsQuitting: (v: boolean) => void;
  },
  serverUrl: string,
) {
  ipcMain.handle('show-notification', async (_event, data: NotificationData) => {
    if (process.platform === 'win32') {
      showCustomNotification(data, deps);
    } else {
      showNativeNotification(data, deps);
    }

    // Windows만: 앱이 포커스되지 않은 상태면 작업 표시줄 주황 하이라이트
    const mainWindow = deps.getMainWindow();
    if (process.platform === 'win32' && mainWindow && !mainWindow.isFocused()) {
      mainWindow.flashFrame(true);
    }
  });

  ipcMain.handle('focus-window', () => {
    const mainWindow = deps.getMainWindow();
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  ipcMain.handle('get-app-version', () => app.getVersion());

  session.defaultSession.on('will-download', (_event, item) => {
    const key = item.getURLChain()[0] ?? item.getURL();
    const pending = pendingDownloads.get(key);
    if (!pending) return; // 일반 다운로드(단건 <a download>)는 기본 동작 그대로
    pendingDownloads.delete(key);
    item.setSavePath(uniqueSavePath(pending.directory ?? app.getPath('downloads'), pending.filename));
    item.once('done', (_e, state) => pending.resolve(state === 'completed'));
  });

  // 일괄 다운로드 저장 폴더 선택 — 데스크톱 관례상 조용히 저장하지 않고 먼저 묻는다 (사용자 결정 2026-08-25)
  ipcMain.handle('choose-download-directory', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: '저장할 폴더 선택',
      defaultPath: app.getPath('downloads'),
      buttonLabel: '저장',
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle('download-url', (event, data: { url?: string; filename?: string; directory?: string }) => {
    if (typeof data?.url !== 'string' || !/^https?:\/\//i.test(data.url) || typeof data?.filename !== 'string') {
      return false;
    }
    // directory는 위 choose-download-directory가 돌려준 절대 경로만 신뢰
    const directory =
      typeof data.directory === 'string' && path.isAbsolute(data.directory) ? data.directory : undefined;
    const url = data.url;
    // 경로 구분자 제거 — 저장 파일명이 다운로드 폴더를 벗어나지 못하게
    const filename = data.filename.replace(/[/\\]/g, '_') || 'download';
    return new Promise<boolean>(resolve => {
      pendingDownloads.set(url, { filename, directory, resolve });
      event.sender.downloadURL(url);
      // will-download가 아예 오지 않는 경우(차단·즉시 실패) 안전망
      setTimeout(() => {
        if (pendingDownloads.delete(url)) resolve(false);
      }, 30_000);
    });
  });

  ipcMain.handle('set-badge-count', (_event, count: number) => {
    const tray = deps.getTray();

    if (process.platform === 'darwin') {
      app.setBadgeCount(count);

      if (tray) {
        if (count > 0) {
          const badgeIcon = nativeImage.createFromPath(getTrayBadgeIconPath());
          badgeIcon.setTemplateImage(false);
          tray.setImage(badgeIcon);
        } else {
          const originalIcon = nativeImage.createFromPath(getTrayIconPath());
          originalIcon.setTemplateImage(true);
          tray.setImage(originalIcon);
        }
      }
    } else if (process.platform === 'win32') {
      // 작업 표시줄 아이콘 우하단 빨간 점 — 트레이가 없어도 동작하도록 트레이와 분리
      const mainWindow = deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (count > 0) {
          mainWindow.setOverlayIcon(getUnreadOverlayIcon(), `읽지 않은 메시지 ${count}개`);
        } else {
          mainWindow.setOverlayIcon(null, '');
        }
      }

      if (!tray) return;
      // 둥근 아이콘 + 우하단 빨간 점(지름 7px) — 가공 로직은 trayIcon.ts (2026-09-01 QA)
      tray.setImage(count > 0 ? getRoundedTrayBadgeIcon() : getRoundedTrayIcon());
    }
  });

  ipcMain.handle('set-tray-auth-state', (_event, isLoggedIn: boolean) => {
    const tray = deps.getTray();
    if (tray) {
      const { isLocked } = getTrayAuthState();
      updateTrayMenu(tray, isLoggedIn, isLocked, deps);
    }
  });

  ipcMain.handle('set-tray-lock-state', (_event, isLocked: boolean) => {
    const tray = deps.getTray();
    if (tray) {
      const { isLoggedIn } = getTrayAuthState();
      updateTrayMenu(tray, isLoggedIn, isLocked, deps);
    }
  });

  ipcMain.handle('set-suppress-esc', (_event, suppress: boolean) => {
    setEscSuppressed(suppress);
  });

  // 멀티 채팅창 — 채팅 목록 우클릭 '새 창에서 열기' (프로토타입 2026-08-21)
  ipcMain.handle('close-chat-window', (_event, roomId: string) => {
    if (typeof roomId === 'string' && roomId) closeChatWindow(roomId);
  });

  ipcMain.handle('open-chat-window', (_event, data: { path?: string; roomId?: string }) => {
    if (!data?.roomId || typeof data.path !== 'string' || !data.path.startsWith('/')) return;
    openChatWindow(serverUrl, data.path, data.roomId);
  });

  /* ─── WebSocket 중계 (멀티 채팅창) ───────────────────────────────
     서버는 한 계정당 최신 소켓 하나에만 브로드캐스트한다. 창마다 소켓을 열면
     나중에 연 창이 수신을 독점하고 먼저 열린 창은 자기가 보낸 메시지의 에코조차 못 받아
     "전송 실패"로 오판한다(실제로는 서버에 저장됨). 그래서 소켓은 메인 창만 갖고,
     팝업은 아래 채널로 송신을 위임하고 수신을 중계받는다. 메인 프로세스는 배선만 한다. */

  // 팝업 → 메인 창: 보낼 메시지 위임
  ipcMain.on('ws-relay:send', (_event, data: unknown) => {
    const mainWindow = deps.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('ws-relay:outbound', data);
  });

  // 메인 창 → 팝업들: 수신 원문 중계
  ipcMain.on('ws-relay:inbound', (_event, raw: string) => {
    broadcastToChatWindows('ws-relay:message', raw);
  });

  // 메인 창 → 팝업들: 연결 상태 전파
  ipcMain.on('ws-relay:status', (_event, connected: boolean) => {
    broadcastToChatWindows('ws-relay:status-changed', connected);
  });

  // 팝업 마운트 직후 현재 상태 조회 (상태 변화 이벤트를 놓친 채 열릴 수 있으므로)
  ipcMain.on('ws-relay:request-status', () => {
    const mainWindow = deps.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('ws-relay:status-request');
  });

  // 로그아웃/세션 종료 — 허브가 사라지면 팝업은 아무것도 못 하므로 함께 닫는다
  ipcMain.on('ws-relay:shutdown', () => {
    closeAllChatWindows();
  });

  /* Windows 타이틀바 오버레이(WCO) 색 동기화 — 버튼 사각형 영역만 지정색으로 그려지므로,
     항상 흰색이면 gray-50 화면(설정 계열)이나 어두운 화면(미디어 뷰어)에서 버튼 부분만
     흰 네모로 도드라진다 (2026-08-31 QA). 렌더러가 현재 화면 상단 배경색을 보내는 기본층 +
     dim이 그 위에 우선 적용되는 2층 구조. 심볼(아이콘) 색은 배경 밝기로 자동 결정. */
  let titleBarBase = { color: '#ffffff', symbolColor: '#333333' };
  let titleBarDimmed = false;
  const applyTitleBar = () => {
    const mainWindow = deps.getMainWindow();
    if ((process.platform !== 'win32' && process.platform !== 'linux') || !mainWindow) return;
    // linux는 Electron 버전에 따라 setTitleBarOverlay 미지원일 수 있어 실패해도 무해하게
    try {
      mainWindow.setTitleBarOverlay(
        titleBarDimmed ? { color: '#666666', symbolColor: '#ffffff' } : titleBarBase,
      );
    } catch { /* 미지원 플랫폼 — 생성 시점의 titleBarOverlay 색 유지 */ }
  };

  ipcMain.handle('set-titlebar-dimmed', (_event, isDimmed: boolean) => {
    titleBarDimmed = isDimmed;
    applyTitleBar();
  });

  ipcMain.handle('set-titlebar-color', (_event, color: unknown) => {
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) return;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    titleBarBase = { color, symbolColor: luminance > 140 ? '#333333' : '#ffffff' };
    applyTitleBar();
  });
}
