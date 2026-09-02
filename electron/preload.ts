// 주의: 여기서 '@sentry/electron/preload'를 import하지 말 것.
// 샌드박스 preload(Electron 20+ 기본)는 node_modules를 require할 수 없어 첫 줄에서 스크립트가
// 통째로 죽고 아래 contextBridge(electronAPI)까지 사라진다 (2026-08-21 사고).
// Sentry 렌더러↔메인 통신은 SDK 내장 프로토콜 폴백이 처리하고, DSN 설정 시 메인 SDK가
// registerPreloadScript로 자체 preload를 스스로 주입한다 — 수동 import 불필요.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (data: {
    title: string;
    body: string;
    profileImageUrl?: string;
    meta?: { roomId?: string; channelType?: string; senderName?: string; navigate?: string };
  }) => ipcRenderer.invoke('show-notification', data),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  // 링크 프리뷰 — 메인 프로세스가 CORS 없이 OG 메타를 파싱 (정적 export 전환으로 서버 route 대체)
  getOgPreview: (url: string) => ipcRenderer.invoke('og-preview', url),
  // 일괄 다운로드 — main downloadURL 경로 (연쇄 <a download>는 크로미엄이 첫 건 이후 차단)
  downloadFile: (data: { url: string; filename: string; directory?: string }) => ipcRenderer.invoke('download-url', data),
  chooseDownloadDirectory: () => ipcRenderer.invoke('choose-download-directory'),
  // 멀티 채팅창 — 채팅 목록 우클릭 '새 창에서 열기' (프로토타입)
  openChatWindow: (data: { path: string; roomId: string }) => ipcRenderer.invoke('open-chat-window', data),
  closeChatWindow: (roomId: string) => ipcRenderer.invoke('close-chat-window', roomId),
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
  // Windows 타이틀바 버튼 영역 배경색 — 현재 화면 상단 배경과 동기화 (hex 6자리)
  setTitleBarColor: (color: string) =>
    ipcRenderer.invoke('set-titlebar-color', color),
  focusWindow: () => ipcRenderer.invoke('focus-window'),
  onNotificationClicked: (callback: (meta: { roomId: string; channelType: string; senderName: string; notReadCount?: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, meta: { roomId: string; channelType: string; senderName: string; notReadCount?: number }) => callback(meta);
    ipcRenderer.on('notification-clicked', handler);
    return () => { ipcRenderer.removeListener('notification-clicked', handler); };
  },
  onNotificationRead: (callback: (meta: { roomId: string; channelType: string; senderName: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, meta: { roomId: string; channelType: string; senderName: string }) => callback(meta);
    ipcRenderer.on('notification-read', handler);
    return () => { ipcRenderer.removeListener('notification-read', handler); };
  },
  // 자동 업데이트
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: { version: string }) => callback(info);
    ipcRenderer.on('update-downloaded', handler);
    return () => { ipcRenderer.removeListener('update-downloaded', handler); };
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  setSuppressEsc: (suppress: boolean) => ipcRenderer.invoke('set-suppress-esc', suppress),

  /* WebSocket 중계 — 소켓은 메인 창(허브)만 갖고 팝업은 여기에 얹는다.
     서버가 한 계정당 최신 소켓 하나에만 브로드캐스트하기 때문 (ipc.ts 주석 참조). */
  wsRelay: {
    /** 팝업 → 허브: 전송 위임 */
    send: (data: unknown) => ipcRenderer.send('ws-relay:send', data),
    /** 허브 → 팝업: 수신 원문 중계 */
    publishInbound: (raw: string) => ipcRenderer.send('ws-relay:inbound', raw),
    /** 허브 → 팝업: 연결 상태 전파 */
    publishStatus: (connected: boolean) => ipcRenderer.send('ws-relay:status', connected),
    /** 팝업: 현재 연결 상태 조회 요청 */
    requestStatus: () => ipcRenderer.send('ws-relay:request-status'),
    /** 허브: 팝업 일괄 종료 요청 (로그아웃/세션 종료) */
    shutdown: () => ipcRenderer.send('ws-relay:shutdown'),

    /** 허브 구독 — 팝업이 위임한 전송 */
    onOutbound: (callback: (data: unknown) => void) => {
      const handler = (_e: unknown, data: unknown) => callback(data);
      ipcRenderer.on('ws-relay:outbound', handler);
      return () => { ipcRenderer.removeListener('ws-relay:outbound', handler); };
    },
    /** 허브 구독 — 팝업의 상태 조회 요청 */
    onStatusRequest: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('ws-relay:status-request', handler);
      return () => { ipcRenderer.removeListener('ws-relay:status-request', handler); };
    },
    /** 팝업 구독 — 중계된 수신 원문 */
    onMessage: (callback: (raw: string) => void) => {
      const handler = (_e: unknown, raw: string) => callback(raw);
      ipcRenderer.on('ws-relay:message', handler);
      return () => { ipcRenderer.removeListener('ws-relay:message', handler); };
    },
    /** 팝업 구독 — 연결 상태 변화 */
    onStatusChanged: (callback: (connected: boolean) => void) => {
      const handler = (_e: unknown, connected: boolean) => callback(connected);
      ipcRenderer.on('ws-relay:status-changed', handler);
      return () => { ipcRenderer.removeListener('ws-relay:status-changed', handler); };
    },
  },
});
