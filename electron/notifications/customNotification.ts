import { BrowserWindow, ipcMain, nativeImage, screen } from 'electron';
import { getIconPath, getNotificationPreloadPath, getNotificationHtmlPath, getDefaultProfilePath } from '../utils';
import type { NotificationData, NotificationDeps } from './types';

// ------------------------------------------------------------------
// 상수 & 상태
// ------------------------------------------------------------------

const NOTIF_WIDTH = 360;
const NOTIF_HEIGHT = 120;
const NOTIF_GAP = 8;
const NOTIF_AUTO_CLOSE_MS = 5000;

const activeNotifications: BrowserWindow[] = [];
const activeNotifByRoom = new Map<string, {
  win: BrowserWindow;
  autoCloseTimer: ReturnType<typeof setTimeout>;
  cleanup: () => void;
}>();
let cachedAppIconDataUrl: string | null = null;
let notifIdCounter = 0;

// ------------------------------------------------------------------
// 내부 유틸
// ------------------------------------------------------------------

function repositionNotifications() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  activeNotifications.forEach((win, index) => {
    if (win.isDestroyed()) return;
    const x = width - NOTIF_WIDTH - 16;
    const y = height - (NOTIF_HEIGHT + NOTIF_GAP) * (index + 1);
    win.setPosition(x, y, false);
  });
}

function removeNotification(win: BrowserWindow) {
  const idx = activeNotifications.indexOf(win);
  if (idx >= 0) activeNotifications.splice(idx, 1);
  if (!win.isDestroyed()) win.close();
  repositionNotifications();
}

async function downloadProfileImage(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return undefined;
  }
}

function getDefaultProfileDataUrl(): string | undefined {
  try {
    return nativeImage.createFromPath(getDefaultProfilePath()).toDataURL();
  } catch {
    return undefined;
  }
}

function ensureAppIconCached() {
  if (!cachedAppIconDataUrl) {
    try {
      const appIcon = nativeImage.createFromPath(getIconPath()).resize({ width: 32, height: 32 });
      cachedAppIconDataUrl = appIcon.toDataURL();
    } catch { /* 아이콘 로드 실패 시 HTML 폴백 사용 */ }
  }
  return cachedAppIconDataUrl;
}

// ------------------------------------------------------------------
// 같은 방의 기존 알림 내용 교체 (새 윈도우 없이 업데이트)
// ------------------------------------------------------------------

function replaceExistingNotification(
  existing: { win: BrowserWindow; autoCloseTimer: ReturnType<typeof setTimeout>; cleanup: () => void },
  data: NotificationData,
  profileDataUrl: string | undefined,
  appIconUrl: string | null,
  roomId: string,
  mainWindow: BrowserWindow | null,
) {
  existing.cleanup();
  clearTimeout(existing.autoCloseTimer);

  const newNotifId = ++notifIdCounter;
  const clickCh = `notification-click-${newNotifId}`;
  const closeCh = `notification-close-${newNotifId}`;
  const readCh = `notification-read-${newNotifId}`;

  existing.win.webContents.send('notification-data', {
    title: data.title, body: data.body,
    profileImageUrl: profileDataUrl, appIconUrl, notifId: newNotifId,
  });

  const cleanup = () => {
    ipcMain.removeListener(clickCh, onClick);
    ipcMain.removeListener(closeCh, onClose);
    ipcMain.removeListener(readCh, onRead);
  };

  const onClick = () => {
    cleanup(); clearTimeout(timer);
    removeNotification(existing.win);
    activeNotifByRoom.delete(roomId);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show(); mainWindow.focus();
      if (data.meta) mainWindow.webContents.send('notification-clicked', data.meta);
    }
  };

  const onClose = () => {
    cleanup(); clearTimeout(timer);
    removeNotification(existing.win);
    activeNotifByRoom.delete(roomId);
  };

  const onRead = () => {
    cleanup(); clearTimeout(timer);
    removeNotification(existing.win);
    activeNotifByRoom.delete(roomId);
    if (mainWindow && data.meta) mainWindow.webContents.send('notification-read', data.meta);
  };

  ipcMain.once(clickCh, onClick);
  ipcMain.once(closeCh, onClose);
  ipcMain.once(readCh, onRead);

  const timer = setTimeout(() => {
    cleanup(); removeNotification(existing.win); activeNotifByRoom.delete(roomId);
  }, NOTIF_AUTO_CLOSE_MS);

  activeNotifByRoom.set(roomId, { win: existing.win, autoCloseTimer: timer, cleanup });
}

// ------------------------------------------------------------------
// Windows 커스텀 알림
// ------------------------------------------------------------------

export async function showCustomNotification(data: NotificationData, deps: NotificationDeps) {
  let profileDataUrl = await downloadProfileImage(data.profileImageUrl);
  if (!profileDataUrl) profileDataUrl = getDefaultProfileDataUrl();

  const appIconUrl = ensureAppIconCached();
  const roomId = data.meta?.roomId;
  const mainWindow = deps.getMainWindow();

  // 같은 방 알림이 이미 떠있으면 내용만 교체
  if (roomId) {
    const existing = activeNotifByRoom.get(roomId);
    if (existing && !existing.win.isDestroyed()) {
      replaceExistingNotification(existing, data, profileDataUrl, appIconUrl, roomId, mainWindow);
      return;
    }
  }

  // 새 알림 윈도우 생성
  const notifId = ++notifIdCounter;
  const clickChannel = `notification-click-${notifId}`;
  const closeChannel = `notification-close-${notifId}`;
  const readChannel = `notification-read-${notifId}`;

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const yIndex = activeNotifications.length;

  const notifWin = new BrowserWindow({
    width: NOTIF_WIDTH, height: NOTIF_HEIGHT,
    x: width - NOTIF_WIDTH - 16,
    y: height - (NOTIF_HEIGHT + NOTIF_GAP) * (yIndex + 1),
    frame: false, alwaysOnTop: true, skipTaskbar: true,
    resizable: false, movable: false, minimizable: false,
    maximizable: false, fullscreenable: false,
    show: false, transparent: true, hasShadow: false,
    webPreferences: {
      preload: getNotificationPreloadPath(),
      contextIsolation: true, nodeIntegration: false,
    },
  });

  activeNotifications.push(notifWin);
  notifWin.loadFile(getNotificationHtmlPath());

  notifWin.once('ready-to-show', () => {
    if (notifWin.isDestroyed()) return;
    notifWin.showInactive();
    notifWin.webContents.send('notification-data', {
      title: data.title, body: data.body,
      profileImageUrl: profileDataUrl, appIconUrl, notifId,
    });
  });

  const cleanup = () => {
    ipcMain.removeListener(clickChannel, onNotifClick);
    ipcMain.removeListener(closeChannel, onNotifClose);
    ipcMain.removeListener(readChannel, onNotifRead);
  };

  const onNotifClick = () => {
    cleanup(); clearTimeout(autoCloseTimer);
    removeNotification(notifWin);
    if (roomId) activeNotifByRoom.delete(roomId);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show(); mainWindow.focus();
      if (data.meta) mainWindow.webContents.send('notification-clicked', data.meta);
    }
  };

  const onNotifClose = () => {
    cleanup(); clearTimeout(autoCloseTimer);
    removeNotification(notifWin);
    if (roomId) activeNotifByRoom.delete(roomId);
  };

  const onNotifRead = () => {
    cleanup(); clearTimeout(autoCloseTimer);
    removeNotification(notifWin);
    if (roomId) activeNotifByRoom.delete(roomId);
    if (mainWindow && data.meta) mainWindow.webContents.send('notification-read', data.meta);
  };

  ipcMain.once(clickChannel, onNotifClick);
  ipcMain.once(closeChannel, onNotifClose);
  ipcMain.once(readChannel, onNotifRead);

  const autoCloseTimer = setTimeout(() => {
    cleanup(); removeNotification(notifWin);
    if (roomId) activeNotifByRoom.delete(roomId);
  }, NOTIF_AUTO_CLOSE_MS);

  if (roomId) {
    activeNotifByRoom.set(roomId, { win: notifWin, autoCloseTimer, cleanup });
  }

  notifWin.on('closed', () => {
    if (roomId) {
      const entry = activeNotifByRoom.get(roomId);
      if (entry?.win === notifWin) {
        entry.cleanup(); clearTimeout(entry.autoCloseTimer);
        activeNotifByRoom.delete(roomId);
      }
    }
    const idx = activeNotifications.indexOf(notifWin);
    if (idx >= 0) activeNotifications.splice(idx, 1);
    repositionNotifications();
  });
}
