import { create } from 'zustand';

/**
 * 시스템 오류(서버 장애) 배너 스토어 (RN systemErrorStore 패리티, 데스크톱 경량판).
 *
 * 개별 요청 실패는 각 화면의 에러 처리가 담당하지만, 5xx·서버 도달 불가가 "여러 요청에
 * 걸쳐" 반복되면 전역 장애로 보고 배너를 띄운다. 단발 실패로 배너가 뜨지 않도록
 * 10초 rolling window 안에 서로 다른 endpoint 증거가 2건 이상일 때만 노출한다.
 * 해소는 SystemErrorBanner의 주기 probe(25초/포커스 복귀)가 담당한다.
 */
const WINDOW_MS = 10_000;
const MIN_UNIQUE_ENDPOINTS = 2;

interface SystemErrorState {
  visible: boolean;
  evidences: Array<{ endpoint: string; at: number }>;
  report: (endpoint: string) => void;
  resolveAll: () => void;
}

/** endpoint 정규화 — id 세그먼트를 ':id'로 (같은 API의 다른 id가 별개 증거로 부풀지 않게) */
export function normalizeEndpoint(path: string): string {
  return path
    .split('?')[0]
    .split('/')
    .map(seg => (/^\d+$/.test(seg) || /^[0-9a-f][0-9a-f-]{7,}$/i.test(seg) ? ':id' : seg))
    .join('/');
}

export const useSystemErrorStore = create<SystemErrorState>((set, get) => ({
  visible: false,
  evidences: [],
  report: endpoint => {
    const now = Date.now();
    const evidences = [
      ...get().evidences.filter(e => now - e.at < WINDOW_MS),
      { endpoint, at: now },
    ];
    const uniqueCount = new Set(evidences.map(e => e.endpoint)).size;
    set({ evidences, visible: get().visible || uniqueCount >= MIN_UNIQUE_ENDPOINTS });
  },
  resolveAll: () => set({ visible: false, evidences: [] }),
}));
