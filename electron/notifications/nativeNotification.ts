import { Notification, nativeImage } from 'electron';
import { getDefaultProfilePath } from '../utils';
import type { NotificationData, NotificationDeps } from './types';

// ------------------------------------------------------------------
// 상태: 같은 방의 알림 그룹 관리
// ------------------------------------------------------------------

const activeNativeNotifByRoom = new Map<string, Notification[]>();

// ------------------------------------------------------------------
// macOS 네이티브 알림
// ------------------------------------------------------------------

export async function showNativeNotification(data: NotificationData, deps: NotificationDeps) {
  const ICON_SIZE = 128;
  let icon: Electron.NativeImage | undefined;

  if (data.profileImageUrl) {
    try {
      console.log('[Notification] 프로필 이미지 다운로드:', data.profileImageUrl.substring(0, 80));
      const res = await fetch(data.profileImageUrl);
      console.log('[Notification] 응답 상태:', res.status, '타입:', res.headers.get('content-type'));
      const buffer = Buffer.from(await res.arrayBuffer());
      console.log('[Notification] 버퍼 크기:', buffer.length, 'bytes');

      icon = nativeImage.createFromBuffer(buffer).resize({ width: ICON_SIZE, height: ICON_SIZE });
      console.log('[Notification] 이미지 생성 결과:', icon?.isEmpty() ? 'empty' : `${icon.getSize().width}x${icon.getSize().height}`);
    } catch (err) {
      console.error('[Notification] 프로필 이미지 로드 실패:', err);
    }
  } else {
    console.log('[Notification] profileImageUrl 없음');
  }

  if (!icon || icon.isEmpty()) {
    console.log('[Notification] 기본 프로필 이미지 사용');
    icon = nativeImage.createFromPath(getDefaultProfilePath());
    console.log('[Notification] 기본 이미지:', icon.isEmpty() ? 'empty' : `${icon.getSize().width}x${icon.getSize().height}`);
  }

  const roomId = data.meta?.roomId;
  const mainWindow = deps.getMainWindow();

  const notif = new Notification({
    title: data.title,
    body: data.body,
    icon,
    actions: [{ type: 'button', text: '읽음' }],
  });

  const closeAllForRoom = () => {
    if (!roomId) return;
    const group = activeNativeNotifByRoom.get(roomId);
    if (!group) return;
    activeNativeNotifByRoom.delete(roomId);
    for (const n of [...group]) {
      try { n.close(); } catch { /* 이미 닫힌 알림 무시 */ }
    }
  };

  const removeSelf = () => {
    if (!roomId) return;
    const group = activeNativeNotifByRoom.get(roomId);
    if (!group) return;
    const idx = group.indexOf(notif);
    if (idx >= 0) group.splice(idx, 1);
    if (group.length === 0) activeNativeNotifByRoom.delete(roomId);
  };

  notif.on('click', () => {
    closeAllForRoom();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show(); mainWindow.focus();
      if (data.meta) mainWindow.webContents.send('notification-clicked', data.meta);
    }
  });

  notif.on('action', (_event, index) => {
    if (index === 0) {
      closeAllForRoom();
      if (mainWindow && data.meta) mainWindow.webContents.send('notification-read', data.meta);
    }
  });

  notif.on('close', () => {
    removeSelf();
  });

  notif.show();

  if (roomId) {
    const group = activeNativeNotifByRoom.get(roomId) ?? [];
    group.push(notif);
    activeNativeNotifByRoom.set(roomId, group);
  }
}
