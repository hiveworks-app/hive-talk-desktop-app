export interface NotificationData {
  title: string;
  body: string;
  profileImageUrl?: string;
  meta?: { roomId: string; channelType: string; senderName: string };
}

export interface NotificationDeps {
  getMainWindow: () => Electron.BrowserWindow | null;
}
