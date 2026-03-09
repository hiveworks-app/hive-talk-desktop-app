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
});
