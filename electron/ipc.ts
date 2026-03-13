import { app, BrowserWindow, ipcMain, nativeImage, Tray } from 'electron';
import { getIconPath, getTrayIconPath, getTrayBadgeIconPath } from './utils';
import { showCustomNotification, showNativeNotification, NotificationData } from './notifications';
import { updateTrayMenu, getTrayAuthState } from './tray';

export function setupIpcHandlers(deps: {
  getMainWindow: () => BrowserWindow | null;
  getTray: () => Tray | null;
  setIsQuitting: (v: boolean) => void;
}) {
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
