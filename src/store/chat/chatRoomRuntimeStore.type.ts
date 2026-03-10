import type { ChatMessageUI, Message, WebSocketReceiveTagProps } from '@/shared/types/websocket';

export type LoadingState = {
  isBeforeLoading: boolean;
  isAfterLoading: boolean;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
};

export type ChatRoomRuntimeState = {
  currentRoomId: string | null;
  messages: ChatMessageUI[];
  loading: LoadingState;
  pendingReadEvents: Map<string, Set<string>>;
  setRoomId: (roomId: string | null) => void;
  setMessages: (updater: (prev: Message[]) => Message[]) => void;
  replaceMessages: (next: Message[]) => void;
  deleteMessageById: (id: string | null) => void;
  setLoading: (patch: Partial<LoadingState>) => void;
  addPendingReadEvent: (messageId: string, userId: string) => void;
  removePendingReadEvents: (messageIds: string[]) => void;
  clearPendingReadEvents: () => void;
  addLocalMessage: (msg: ChatMessageUI) => void;
  patchMessageByFileId: (fileId: string, partial: Partial<ChatMessageUI>) => void;
  replaceLocalWithServer: (fileId: string, serverMessage: Message) => void;
  removeLocalMessage: (fileId: string) => void;
  scrollToBottomTrigger: number;
  requestScrollToBottom: () => void;
  pendingRemoveTagMessageId: string | null;
  setPendingRemoveTagMessageId: (id: string | null) => void;
  reset: () => void;
};

export type Ephemeral = {
  searchKeyword: string;
  setSearchKeyword: (keyword: string) => void;
  activeSearchKeyword: string;
  setActiveSearchKeyword: (keyword: string) => void;
  isSearchMode: boolean;
  setIsSearchMode: (active: boolean) => void;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;
  focusedMessageId: string | null;
  setFocusedMessageId: (id: string | null) => void;
  currentSearchIndex: number;
  setCurrentSearchIndex: (index: number) => void;
  nextMyTags: WebSocketReceiveTagProps[] | null;
  setNextMyTags: (tags: WebSocketReceiveTagProps[] | null) => void;
  peekNextMyTags: () => WebSocketReceiveTagProps[] | null;
  consumeNextMyTags: () => WebSocketReceiveTagProps[] | null;
};

export type ChatRoomRuntimeTypes = ChatRoomRuntimeState & Ephemeral;
