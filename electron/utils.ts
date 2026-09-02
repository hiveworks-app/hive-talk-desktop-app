import { app } from 'electron';
import path from 'path';

export const isDev = !app.isPackaged;
export const DEV_PORT = 23000;

// ------------------------------------------------------------------
// Path Helpers
// ------------------------------------------------------------------

export function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

export function getNotificationPreloadPath() {
  return path.join(__dirname, 'notification-preload.js');
}

export function getNotificationHtmlPath() {
  return path.join(__dirname, 'notification.html');
}

export function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  return isDev
    ? path.join(app.getAppPath(), 'resources', iconName)
    : path.join(process.resourcesPath, iconName);
}

export function getTrayIconPath() {
  const base = isDev
    ? path.join(app.getAppPath(), 'resources')
    : process.resourcesPath;
  return path.join(base, 'trayIconTemplate.png');
}

export function getTrayBadgeIconPath() {
  const base = isDev
    ? path.join(app.getAppPath(), 'resources')
    : process.resourcesPath;
  return path.join(base, 'trayIconBadge.png');
}

export function getDefaultProfilePath() {
  const base = isDev
    ? path.join(app.getAppPath(), 'resources')
    : process.resourcesPath;
  return path.join(base, 'notification-profile-default.png');
}

// 포트 헬퍼(isPortAvailable/findFreePort/waitForServer)는 정적 export 전환(2026-09-02)으로 제거 —
// 프로덕션이 내장 서버 없이 app:// 프로토콜(electron/protocol.ts)로 번들을 서빙한다.
// DEV_PORT는 dev(next dev -p 23000) 접속용으로만 남는다.
