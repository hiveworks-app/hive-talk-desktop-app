'use client';

import { create } from 'zustand';
import { IS_DELETE_MESSAGE_COMMENTS } from '@/shared/config/constants';
import { ChatMessageUI, WebSocketReceiveTagProps } from '@/shared/types/websocket';
import type { ChatRoomRuntimeTypes } from './chatRoomRuntimeStore.type';

export type {
  LoadingState,
  ChatRoomRuntimeState,
  Ephemeral,
  ChatRoomRuntimeTypes,
} from './chatRoomRuntimeStore.type';

const initState = {
  currentRoomId: null as string | null,
  messages: [] as ChatMessageUI[],
  loading: {
    isBeforeLoading: false,
    isAfterLoading: false,
    hasMoreBefore: true,
    hasMoreAfter: true,
  },
  pendingReadEvents: new Map<string, Set<string>>(),
  nextMyTags: null as WebSocketReceiveTagProps[] | null,
  searchKeyword: '',
  activeSearchKeyword: '',
  isSearchMode: false,
  isSearching: false,
  focusedMessageId: null as string | null,
  currentSearchIndex: 0,
  scrollToBottomTrigger: 0,
  pendingRemoveTagMessageId: null as string | null,
};

export const useChatRoomRuntimeStore = create<ChatRoomRuntimeTypes>((set, get) => ({
  ...initState,
  setRoomId: roomId => set({ currentRoomId: roomId }),
  setMessages: updater => set(state => ({ messages: updater(state.messages) })),
  replaceMessages: next => set({ messages: next }),
  deleteMessageById: messageId =>
    set(state => ({
      messages: state.messages.map(m =>
        m.id === messageId
          ? {
              ...m,
              isDeleted: true,
              messageContentType: 'TEXT',
              text: IS_DELETE_MESSAGE_COMMENTS,
              files: [],
            }
          : m,
      ),
    })),
  setLoading: patch => set(state => ({ loading: { ...state.loading, ...patch } })),
  setNextMyTags: tags => set({ nextMyTags: tags }),
  peekNextMyTags: () => get().nextMyTags,
  consumeNextMyTags: () => {
    const tags = get().nextMyTags;
    if (tags) set({ nextMyTags: null });
    return tags;
  },
  setSearchKeyword: keyword => set({ searchKeyword: keyword }),
  setActiveSearchKeyword: keyword => set({ activeSearchKeyword: keyword }),
  setIsSearchMode: active =>
    set({
      isSearchMode: active,
      currentSearchIndex: 0,
      focusedMessageId: null,
      isSearching: false,
      ...(active === false && { searchKeyword: '', activeSearchKeyword: '' }),
    }),
  setIsSearching: searching => set({ isSearching: searching }),
  setFocusedMessageId: id => set({ focusedMessageId: id }),
  setCurrentSearchIndex: index => set({ currentSearchIndex: index }),
  addPendingReadEvent: (messageId, userId) =>
    set(state => {
      const nextMap = new Map(state.pendingReadEvents);
      const userSet = nextMap.get(messageId) ?? new Set();
      userSet.add(userId);
      nextMap.set(messageId, userSet);
      return { pendingReadEvents: nextMap };
    }),
  removePendingReadEvents: messageIds =>
    set(state => {
      const nextMap = new Map(state.pendingReadEvents);
      let changed = false;
      for (const messageId of messageIds) {
        if (nextMap.has(messageId)) {
          nextMap.delete(messageId);
          changed = true;
        }
      }
      return changed ? { pendingReadEvents: nextMap } : {};
    }),
  clearPendingReadEvents: () => set({ pendingReadEvents: new Map() }),
  addLocalMessage: msg =>
    set(state => {
      if (msg.fileId) {
        const exists = state.messages.some(m => m.fileId === msg.fileId);
        if (exists) return state;
      }
      return { messages: [...state.messages, msg] };
    }),
  patchMessageByFileId: (fileId, partial) =>
    set(state => {
      const idx = state.messages.findIndex(m => m.fileId === fileId);
      if (idx === -1) return state;
      const next = state.messages.slice();
      next[idx] = { ...next[idx], ...partial };
      return { messages: next };
    }),
  replaceLocalWithServer: (fileId, serverMessage) =>
    set(state => {
      const idx = state.messages.findIndex(m => m.fileId === fileId);
      if (idx === -1) {
        return {
          messages: [
            ...state.messages,
            {
              ...serverMessage,
              fileId,
              isLocal: false,
              localStatus: 'sent',
            } as ChatMessageUI,
          ],
        };
      }
      const prev = state.messages[idx];
      const next = state.messages.slice();
      next[idx] = {
        ...(serverMessage as ChatMessageUI),
        fileId,
        isLocal: false,
        localStatus: 'sent',
        localUris: prev.localUris,
      };
      return { messages: next };
    }),
  removeLocalMessage: fileId =>
    set(state => ({
      messages: state.messages.filter(m => m.fileId !== fileId),
    })),
  requestScrollToBottom: () =>
    set(state => ({ scrollToBottomTrigger: state.scrollToBottomTrigger + 1 })),
  setPendingRemoveTagMessageId: id => set({ pendingRemoveTagMessageId: id }),
  reset: () => set({ ...initState, pendingReadEvents: new Map() }),
}));
