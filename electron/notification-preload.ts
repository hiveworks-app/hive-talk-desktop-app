import { contextBridge, ipcRenderer } from 'electron';

let notifId: number | null = null;

contextBridge.exposeInMainWorld('notificationAPI', {
  onData: (callback: (data: { title: string; body: string; profileImageUrl?: string; notifId: number }) => void) => {
    ipcRenderer.on('notification-data', (_event, data) => {
      notifId = data.notifId;
      callback(data);
    });
  },
  close: () => {
    if (notifId !== null) ipcRenderer.send(`notification-close-${notifId}`);
  },
  click: () => {
    if (notifId !== null) ipcRenderer.send(`notification-click-${notifId}`);
  },
  read: () => {
    if (notifId !== null) ipcRenderer.send(`notification-read-${notifId}`);
  },
});
