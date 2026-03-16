import { create } from 'zustand';
import type { TagListType } from '@/shared/types/tag';
import type { ChatMessageUI } from '@/shared/types/websocket';

/* ── 태그 UI 상태 (패널 열림/닫힘, 모드) ── */

interface SelectedMessageForTag {
  id: string;
  tagsId: string[];
  originalTags: TagListType[];
}

interface TagUIState {
  isTagOpen: boolean;
  tagActionType: 'ADD' | 'UPDATE' | null;
  selectedMessage: SelectedMessageForTag | null;
}

interface TagUIActions {
  setIsTagOpen: (isOpen: boolean) => void;
  setTagActionType: (type: 'ADD' | 'UPDATE' | null) => void;
  setSelectedMessage: (message: SelectedMessageForTag | null) => void;
  openAddMode: () => void;
  openUpdateMode: (message: ChatMessageUI) => void;
  closeTagPanel: () => void;
}

export const useTagStore = create<TagUIState & TagUIActions>(set => ({
  isTagOpen: false,
  tagActionType: null,
  selectedMessage: null,

  setIsTagOpen: isOpen => set({ isTagOpen: isOpen }),
  setTagActionType: type => set({ tagActionType: type }),
  setSelectedMessage: message => set({ selectedMessage: message }),

  openAddMode: () => {
    useSelectedTagStore.getState().resetSelectedTags();
    set({
      isTagOpen: true,
      tagActionType: 'ADD',
      selectedMessage: null,
    });
  },

  openUpdateMode: (message: ChatMessageUI) => {
    // 기존 태그를 selectedTags에도 초기화
    useSelectedTagStore.getState().setSelectedTags(message.tags ?? []);
    set({
      isTagOpen: true,
      tagActionType: 'UPDATE',
      selectedMessage: {
        id: message.id,
        tagsId: (message.tags ?? []).map(t => String(t.tagId)),
        originalTags: message.tags ?? [],
      },
    });
  },

  closeTagPanel: () =>
    set({
      isTagOpen: false,
      tagActionType: null,
      selectedMessage: null,
    }),
}));

/* ── 선택된 태그 (ADD/UPDATE 모드에서 선택한 태그 배열) ── */

interface SelectedTagState {
  selectedTags: TagListType[];
}

interface SelectedTagActions {
  toggleTag: (tag: TagListType) => void;
  setSelectedTags: (tags: TagListType[]) => void;
  resetSelectedTags: () => void;
}

export const useSelectedTagStore = create<SelectedTagState & SelectedTagActions>(set => ({
  selectedTags: [],

  toggleTag: tag =>
    set(state => {
      const targetId = Number(tag.tagId);
      const exists = state.selectedTags.some(t => Number(t.tagId) === targetId);
      return {
        selectedTags: exists
          ? state.selectedTags.filter(t => Number(t.tagId) !== targetId)
          : [...state.selectedTags, tag],
      };
    }),

  setSelectedTags: tags => set({ selectedTags: tags }),

  resetSelectedTags: () => set({ selectedTags: [] }),
}));
