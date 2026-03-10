import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (data: {
    title: string;
    body: string;
    profileImageUrl?: string;
    meta?: { roomId: string; channelType: string; senderName: string };
  }) => ipcRenderer.invoke('show-notification', data),
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
  onNotificationClicked: (callback: (meta: { roomId: string; channelType: string; senderName: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, meta: { roomId: string; channelType: string; senderName: string }) => callback(meta);
    ipcRenderer.on('notification-clicked', handler);
    return () => { ipcRenderer.removeListener('notification-clicked', handler); };
  },
  onNotificationRead: (callback: (meta: { roomId: string; channelType: string; senderName: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, meta: { roomId: string; channelType: string; senderName: string }) => callback(meta);
    ipcRenderer.on('notification-read', handler);
    return () => { ipcRenderer.removeListener('notification-read', handler); };
  },
});
