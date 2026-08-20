import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * 채팅방 입력 드래프트 스토어 (RN 드래프트 보존 패리티 — 데스크톱은 localStorage 영속).
 * 방별로 미전송 입력을 보존해 재진입 시 복원하고, 채팅 목록의 "작성중" 표시 판정 소스가 된다.
 * 전송 완료 시 삭제. 공백만 남은 드래프트는 저장하지 않는다.
 */
interface DraftState {
  drafts: Record<string, string>;
  setDraft: (roomId: string, text: string) => void;
  clearDraft: (roomId: string) => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    set => ({
      drafts: {},
      setDraft: (roomId, text) => {
        if (!roomId) return;
        set(state => {
          const drafts = { ...state.drafts };
          if (text.trim().length === 0) delete drafts[roomId];
          else drafts[roomId] = text;
          return { drafts };
        });
      },
      clearDraft: roomId => {
        set(state => {
          if (!(roomId in state.drafts)) return state;
          const drafts = { ...state.drafts };
          delete drafts[roomId];
          return { drafts };
        });
      },
    }),
    {
      name: 'chat-drafts',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
