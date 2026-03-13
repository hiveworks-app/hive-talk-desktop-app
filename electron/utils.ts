import { app } from 'electron';
import path from 'path';
import net from 'net';

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

// ------------------------------------------------------------------
// Network Helpers
// ------------------------------------------------------------------

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

export function waitForServer(url: string, timeout = 30_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      fetch(url)
        .then((res) => {
          if (res.ok || res.status < 500) resolve();
          else retry();
        })
        .catch(retry);
    };
    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error(`Server did not start within ${timeout}ms`));
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}
