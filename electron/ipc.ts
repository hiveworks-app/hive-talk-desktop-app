import { app, BrowserWindow, ipcMain, nativeImage, Tray } from 'electron';
import { getIconPath, getTrayIconPath, getTrayBadgeIconPath } from './utils';
import { showCustomNotification, showNativeNotification, NotificationData } from './notifications';
import { updateTrayMenu, getTrayAuthState } from './tray';
import { setEscSuppressed, openChatWindow, broadcastToChatWindows, closeAllChatWindows } from './window';

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
    } else if (process.platform === 'win32' && tray) {
      const baseIcon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 });
      if (count > 0) {
        const size = 16;
        const raw = baseIcon.toBitmap();
        const dotRadius = 5;
        const dotCenterX = size - dotRadius;
        const dotCenterY = size - dotRadius;
        const borderRadius = dotRadius + 1;

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const dx = x - dotCenterX;
            const dy = y - dotCenterY;
            const dist = dx * dx + dy * dy;
            const offset = (y * size + x) * 4;
            if (dist <= dotRadius * dotRadius) {
              raw[offset] = 0x30; raw[offset + 1] = 0x3B;
              raw[offset + 2] = 0xFF; raw[offset + 3] = 0xFF;
            } else if (dist <= borderRadius * borderRadius) {
              raw[offset] = 0x00; raw[offset + 1] = 0x00;
              raw[offset + 2] = 0x00; raw[offset + 3] = 0xFF;
            }
          }
        }

        tray.setImage(nativeImage.createFromBuffer(raw, { width: size, height: size }));
      } else {
        tray.setImage(baseIcon);
      }
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

  ipcMain.handle('set-titlebar-dimmed', (_event, isDimmed: boolean) => {
    const mainWindow = deps.getMainWindow();
    if (process.platform !== 'win32' || !mainWindow) return;
    mainWindow.setTitleBarOverlay(
      isDimmed
        ? { color: '#666666', symbolColor: '#ffffff' }
        : { color: '#ffffff', symbolColor: '#333333' },
    );
  });
}
