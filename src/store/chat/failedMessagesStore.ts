import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ChatMessageUI } from '@/shared/types/websocket';

/**
 * 전송 실패 메시지 영속 스토어 (RN pending_messages 영속화 패리티 — 데스크톱은 localStorage).
 * - 방 이탈/앱 재실행 후에도 실패 메시지를 복원해 재전송/삭제 UI를 유지한다.
 * - 채팅 목록의 전송 실패 느낌표 표시의 판정 소스.
 * TEXT 로컬 메시지만 대상 (미디어는 로컬 blob이라 재실행 후 복원 불가).
 */
interface FailedMessagesState {
  byRoom: Record<string, ChatMessageUI[]>;
  saveFailed: (roomId: string, message: ChatMessageUI) => void;
  removeFailed: (roomId: string, messageId: string) => void;
  /** 방 나가기 시 해당 방 실패 메시지 일괄 정리 */
  removeRoom: (roomId: string) => void;
  clearAll: () => void;
}

export const useFailedMessagesStore = create<FailedMessagesState>()(
  persist(
    set => ({
      byRoom: {},
      saveFailed: (roomId, message) => {
        if (!roomId) return;
        set(state => {
          const prev = state.byRoom[roomId] ?? [];
          const next = [
            ...prev.filter(m => m.id !== message.id),
            { ...message, localStatus: 'failed' as const },
          ];
          return { byRoom: { ...state.byRoom, [roomId]: next } };
        });
      },
      removeFailed: (roomId, messageId) => {
        set(state => {
          const prev = state.byRoom[roomId];
          if (!prev) return state;
          const next = prev.filter(m => m.id !== messageId);
          const byRoom = { ...state.byRoom };
          if (next.length === 0) delete byRoom[roomId];
          else byRoom[roomId] = next;
          return { byRoom };
        });
      },
      removeRoom: roomId => {
        set(state => {
          if (!(roomId in state.byRoom)) return state;
          const byRoom = { ...state.byRoom };
          delete byRoom[roomId];
          return { byRoom };
        });
      },
      clearAll: () => set({ byRoom: {} }),
    }),
    {
      name: 'failed-messages',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
