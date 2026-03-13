import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';
import { getIconPath, getTrayIconPath } from './utils';

let trayIsLoggedIn = false;
let trayIsLocked = false;

export function updateTrayMenu(
  tray: Tray,
  isLoggedIn: boolean,
  isLocked: boolean,
  deps: {
    getMainWindow: () => BrowserWindow | null;
    setIsQuitting: (v: boolean) => void;
  },
) {
  trayIsLoggedIn = isLoggedIn;
  trayIsLocked = isLocked;

  const mainWindow = deps.getMainWindow();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'HiveTalk 열기',
      click: () => { mainWindow?.show(); mainWindow?.focus(); },
    },
    { type: 'separator' },
    {
      label: '잠금모드',
      enabled: isLoggedIn && !isLocked,
      click: () => {
        mainWindow?.webContents.send('tray-lock-mode');
        mainWindow?.show();
      },
    },
    { type: 'separator' },
    {
      label: '로그아웃',
      enabled: isLoggedIn,
      click: () => {
        mainWindow?.webContents.send('tray-logout');
        mainWindow?.show(); mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => { deps.setIsQuitting(true); app.quit(); },
    },
    { type: 'separator' },
    {
      label: '개발자 도구',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.toggleDevTools();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

export function getTrayAuthState() {
  return { isLoggedIn: trayIsLoggedIn, isLocked: trayIsLocked };
}

export function createTray(deps: {
  getMainWindow: () => BrowserWindow | null;
  setIsQuitting: (v: boolean) => void;
}): Tray {
  let icon: Electron.NativeImage;

  if (process.platform === 'darwin') {
    icon = nativeImage.createFromPath(getTrayIconPath());
    icon.setTemplateImage(true);
  } else {
    icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 });
  }

  const tray = new Tray(icon);
  tray.setToolTip('HiveTalk');
  updateTrayMenu(tray, false, false, deps);

  if (process.platform !== 'darwin') {
    tray.on('double-click', () => {
      const mainWindow = deps.getMainWindow();
      mainWindow?.show(); mainWindow?.focus();
    });
  }

  return tray;
}
