import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('show-notification', title, body),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  setBadgeCount: (count: number) => ipcRenderer.invoke('set-badge-count', count),
  isElectron: true,
  platform: process.platform,
  onTrayLockMode: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('tray-lock-mode', handler);
    return () => { ipcRenderer.removeListener('tray-lock-mode', handler); };
  },
  onTrayLogout: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('tray-logout', handler);
    return () => { ipcRenderer.removeListener('tray-logout', handler); };
  },
  setTrayAuthState: (isLoggedIn: boolean) =>
    ipcRenderer.invoke('set-tray-auth-state', isLoggedIn),
  setTrayLockState: (isLocked: boolean) =>
    ipcRenderer.invoke('set-tray-lock-state', isLocked),
  setTitleBarDimmed: (isDimmed: boolean) =>
    ipcRenderer.invoke('set-titlebar-dimmed', isDimmed),
  focusWindow: () => ipcRenderer.invoke('focus-window'),
});
