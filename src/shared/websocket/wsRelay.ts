'use client';

/**
 * WebSocket 창간 중계 어댑터 (Electron 전용).
 *
 * ## 왜 필요한가
 * 서버는 한 계정당 **최신 소켓 하나에만** 브로드캐스트한다. 창마다 소켓을 열면 나중에 연 창이
 * 수신을 독점하고, 먼저 열린 창은 자기가 보낸 메시지의 에코조차 못 받아 5초 뒤 "전송 실패"로
 * 오판한다 — 서버에는 정상 저장돼 있어서 새로고침하면 멀쩡히 보이는, 가장 헷갈리는 형태의 버그다.
 * (더 나쁜 건 사용자가 그 실패 표시를 보고 재전송을 눌러 중복 발송되는 것)
 *
 * 그래서 소켓은 메인 창(허브) 하나만 갖고, 멀티 채팅창(팝업)은 송신을 위임하고 수신을 중계받는다.
 *
 * ## 역할
 * - 허브(메인 창): 실제 소켓 소유 → 인바운드 원문을 팝업에 뿌리고, 팝업이 위임한 전송을 대신 보낸다
 * - 스포크(팝업): 소켓을 열지 않고 이 모듈로만 송수신한다
 *
 * Electron이 아니거나 preload가 없으면 전부 no-op이 되어, 웹 빌드는 기존 단일 소켓 동작을 유지한다.
 */

interface WsRelayApi {
  send: (data: unknown) => void;
  publishInbound: (raw: string) => void;
  publishStatus: (connected: boolean) => void;
  requestStatus: () => void;
  shutdown: () => void;
  onOutbound: (cb: (data: unknown) => void) => () => void;
  onStatusRequest: (cb: () => void) => () => void;
  onMessage: (cb: (raw: string) => void) => () => void;
  onStatusChanged: (cb: (connected: boolean) => void) => () => void;
}

const noop = () => {};
const noopUnsub = () => noop;

function getApi(): WsRelayApi | null {
  if (typeof window === 'undefined') return null;
  const electronAPI = (window as unknown as { electronAPI?: { wsRelay?: WsRelayApi } }).electronAPI;
  return electronAPI?.wsRelay ?? null;
}

/** 중계 배선을 쓸 수 있는 환경인가 (Electron + preload 정상) */
export const isRelayAvailable = () => getApi() !== null;

export const wsRelay: WsRelayApi = {
  send: data => getApi()?.send(data),
  publishInbound: raw => getApi()?.publishInbound(raw),
  publishStatus: connected => getApi()?.publishStatus(connected),
  requestStatus: () => getApi()?.requestStatus(),
  shutdown: () => getApi()?.shutdown(),
  onOutbound: cb => getApi()?.onOutbound(cb) ?? noopUnsub(),
  onStatusRequest: cb => getApi()?.onStatusRequest(cb) ?? noopUnsub(),
  onMessage: cb => getApi()?.onMessage(cb) ?? noopUnsub(),
  onStatusChanged: cb => getApi()?.onStatusChanged(cb) ?? noopUnsub(),
};
