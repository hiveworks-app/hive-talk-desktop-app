/**
 * WebSocket 애플리케이션 레벨 하트비트 (PING/PONG)
 *
 * 해결하는 두 가지 문제 (별개의 메커니즘):
 * 1. keep-alive — Cloudflare는 약 100초간 트래픽이 없는 WebSocket을 끊는다(close 1006).
 *    30초 주기 PING "송신"만으로 idle 타이머가 리셋되어 끊김을 막는다.
 * 2. liveness detection — half-open(좀비) 소켓은 FIN이 오지 않아 onclose가 수십 분간
 *    울리지 않고, online 복구 가드(navigator.onLine)도 통과하지 못해 회수 경로가 없다.
 *    PING 후 PONG_TIMEOUT_MS 내 인바운드가 없으면 죽은 연결로 판정하고 onDead로 통지,
 *    호출부가 ws.close()로 기존 재연결 경로(onclose → 백오프 → 토큰갱신/복구)에 태운다.
 *
 * 판정 기준은 "PONG 수신"이 아니라 "아무 인바운드 수신"이다 — PING과 PONG 사이에
 * 일반 메시지가 끼어들면 그것만으로 생존이 증명되므로, PONG만 늦었을 때
 * 멀쩡한 연결을 끊는 오판(false positive)을 막는다.
 *
 * smart heartbeat: 최근 PING_INTERVAL_MS 내 인바운드가 있었으면 해당 tick의 PING을
 * 생략한다. 활발한 대화 중에는 수신 자체가 생존 증거 + Cloudflare 타이머 리셋이므로
 * 불필요한 송신을 줄인다. (최대 침묵 ≈ 2×INTERVAL - 1 = 59초 + PONG 10초 = 69초로
 * Cloudflare 100초 한도 안에서 안전)
 */

const PING_INTERVAL_MS = 30_000; // Cloudflare ~100초 idle timeout의 1/3 마진
const PONG_TIMEOUT_MS = 10_000; // 네트워크 RTT 여유 포함 응답 대기

/** 백엔드 합의 사양: 서버는 PING 수신 시 에러/연결종료 없이 해당 세션에 PONG 응답 */
const PING_MESSAGE = JSON.stringify({ operationType: 'PING' });

const WS_READY_STATE_OPEN = 1; // WebSocket.OPEN

/** 브라우저/Electron WebSocket과 구조적으로 호환되는 최소 인터페이스 (테스트/결합도 최소화) */
interface HeartbeatSocket {
  readyState: number;
  send(data: string): void;
  close(): void;
}

interface HeartbeatOptions {
  /** 죽은 연결 판정 시 호출 — 호출부는 close()로 기존 재연결 경로에 태운다 */
  onDead: (ws: HeartbeatSocket) => void;
}

export interface HeartbeatController {
  /** 연결 성공(onopen) 시 호출 — 이전 연결의 타이머는 정리 후 새로 시작 */
  start(ws: HeartbeatSocket): void;
  /** 연결 종료(onclose/disconnect) 시 호출 — 모든 타이머 정리 */
  stop(): void;
  /** 아무 인바운드 메시지 수신 시 호출 — 생존 증거로 PONG 대기 해제 */
  notifyInbound(): void;
}

/**
 * 서버 PONG 응답(`{operationType: 'PONG'}`) 판별.
 * PONG은 onmessage 최상단의 notifyInbound()로 역할이 끝나므로,
 * 호출부는 이 가드로 조기 종료하여 방 리스너 전달 등 후속 처리를 생략한다.
 */
export function isPongMessage(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  return 'operationType' in data && data.operationType === 'PONG';
}

export function createHeartbeat({ onDead }: HeartbeatOptions): HeartbeatController {
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let pongTimer: ReturnType<typeof setTimeout> | null = null;
  let lastInboundAt = 0;

  const clearPongTimer = () => {
    if (pongTimer) {
      clearTimeout(pongTimer);
      pongTimer = null;
    }
  };

  const stop = () => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    clearPongTimer();
  };

  const start = (ws: HeartbeatSocket) => {
    stop();
    lastInboundAt = Date.now();

    pingTimer = setInterval(() => {
      // smart heartbeat: 최근 인바운드가 곧 생존 증거이므로 이번 PING 생략
      if (Date.now() - lastInboundAt < PING_INTERVAL_MS) return;

      // close 직후 잔여 tick 방어 — 닫힌 소켓에 send 시도 금지
      if (ws.readyState !== WS_READY_STATE_OPEN) return;

      try {
        ws.send(PING_MESSAGE);
      } catch (err) {
        console.warn('[WS][HEARTBEAT] PING 전송 실패:', err);
        return;
      }

      // 이미 응답 대기 중이면 타이머 갱신 금지 — 최초 PING 기준으로 침묵 시간을 측정
      if (!pongTimer) {
        pongTimer = setTimeout(() => {
          pongTimer = null;
          console.warn('[WS][HEARTBEAT] PONG 타임아웃 → 죽은 연결 판정, 재연결 경로로 보냅니다.');
          stop();
          onDead(ws);
        }, PONG_TIMEOUT_MS);
      }
    }, PING_INTERVAL_MS);
  };

  const notifyInbound = () => {
    lastInboundAt = Date.now();
    clearPongTimer();
  };

  return { start, stop, notifyInbound };
}
