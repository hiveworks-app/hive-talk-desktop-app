'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ChatMessageUI, WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';

interface UseChatRoomSearchOptions {
  /** 메시지 컨테이너 ref - 스크롤 제어용 */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** 이전 메시지 로드 함수 */
  loadMoreBeforeMessage: () => void;
}

interface UseChatRoomSearchReturn {
  isSearchMode: boolean;
  searchKeyword: string;
  isSearching: boolean;
  searchResults: number[];
  currentIndex: number;
  displayIndex: number;
  totalCount: number;
  focusedMessageId: string | null;
  canGoPrev: boolean;
  canGoNext: boolean;
  enterSearchMode: () => void;
  exitSearchMode: () => void;
  handleSearchKeywordChange: (keyword: string) => void;
  handleSearchSubmit: (keyword: string) => void;
  goToPrevious: () => void;
  goToNext: () => void;
}

function findSearchResults(messages: ChatMessageUI[], keyword: string): number[] {
  if (!keyword.trim()) return [];
  const lowerKeyword = keyword.toLowerCase();
  const results: number[] = [];

  messages.forEach((msg, index) => {
    if (msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT && !msg.isDeleted) {
      if (msg.text.toLowerCase().includes(lowerKeyword)) {
        results.push(index);
      }
    }
  });

  return results;
}

async function waitForBeforeLoadComplete(
  prevMessageCount: number,
  timeout = 10000,
): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 50));

  return new Promise(resolve => {
    const startTime = Date.now();
    const check = () => {
      const state = useChatRoomRuntimeStore.getState();
      const messagesUpdated = state.messages.length > prevMessageCount;
      const noMoreMessages = !state.loading.hasMoreBefore;
      const loadingComplete = !state.loading.isBeforeLoading;

      if (loadingComplete && (messagesUpdated || noMoreMessages)) {
        resolve(true);
        return;
      }
      if (Date.now() - startTime > timeout) {
        resolve(false);
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}

export function useChatRoomSearch({
  containerRef,
  loadMoreBeforeMessage,
}: UseChatRoomSearchOptions): UseChatRoomSearchReturn {
  const messages = useChatRoomRuntimeStore(s => s.messages);
  const searchKeyword = useChatRoomRuntimeStore(s => s.searchKeyword);
  const activeSearchKeyword = useChatRoomRuntimeStore(s => s.activeSearchKeyword);
  const isSearchMode = useChatRoomRuntimeStore(s => s.isSearchMode);
  const isSearching = useChatRoomRuntimeStore(s => s.isSearching);
  const focusedMessageId = useChatRoomRuntimeStore(s => s.focusedMessageId);
  const { hasMoreBefore } = useChatRoomRuntimeStore(s => s.loading);

  const setSearchKeyword = useChatRoomRuntimeStore(s => s.setSearchKeyword);
  const setActiveSearchKeyword = useChatRoomRuntimeStore(s => s.setActiveSearchKeyword);
  const setIsSearchMode = useChatRoomRuntimeStore(s => s.setIsSearchMode);
  const setIsSearching = useChatRoomRuntimeStore(s => s.setIsSearching);
  const setFocusedMessageId = useChatRoomRuntimeStore(s => s.setFocusedMessageId);
  const setCurrentSearchIndex = useChatRoomRuntimeStore(s => s.setCurrentSearchIndex);

  const abortSearchRef = useRef(false);
  const isNavigatingRef = useRef(false);
  const isMountedRef = useRef(true);
  const NAVIGATION_COOLDOWN = 300;

  const searchResults = useMemo(() => {
    if (!activeSearchKeyword.trim() || !isSearchMode) return [];
    return findSearchResults(messages, activeSearchKeyword);
  }, [activeSearchKeyword, messages, isSearchMode]);

  const currentIndex = useMemo(() => {
    if (!focusedMessageId || searchResults.length === 0) return 0;
    const messageIndex = messages.findIndex(m => m.id === focusedMessageId);
    if (messageIndex === -1) return 0;
    const resultIndex = searchResults.indexOf(messageIndex);
    return resultIndex !== -1 ? resultIndex : 0;
  }, [focusedMessageId, searchResults, messages]);

  const enterSearchMode = useCallback(() => setIsSearchMode(true), [setIsSearchMode]);

  const exitSearchMode = useCallback(() => {
    abortSearchRef.current = true;
    setIsSearchMode(false);
  }, [setIsSearchMode]);

  const handleSearchKeywordChange = useCallback(
    (keyword: string) => setSearchKeyword(keyword),
    [setSearchKeyword],
  );

  // Web: data-msg-index로 해당 메시지 element를 찾아 scrollIntoView
  const scrollToMessageIndex = useCallback(
    (messageIndex: number) => {
      if (!isMountedRef.current || !containerRef.current) return;

      requestAnimationFrame(() => {
        if (!isMountedRef.current || !containerRef.current) return;

        const el = containerRef.current.querySelector(
          `[data-msg-index="${messageIndex}"]`,
        );
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      });
    },
    [containerRef],
  );

  const executeInfiniteSearch = useCallback(
    async (keyword: string): Promise<{ found: boolean; messageId: string | null }> => {
      abortSearchRef.current = false;
      setIsSearching(true);

      try {
        let currentMessages = useChatRoomRuntimeStore.getState().messages;
        let results = findSearchResults(currentMessages, keyword);

        if (!isMountedRef.current) return { found: false, messageId: null };

        if (results.length > 0) {
          const lastResultIndex = results[results.length - 1];
          const messageId = currentMessages[lastResultIndex]?.id ?? null;
          setFocusedMessageId(messageId);
          setCurrentSearchIndex(results.length - 1);
          scrollToMessageIndex(lastResultIndex);
          return { found: true, messageId };
        }

        let state = useChatRoomRuntimeStore.getState();
        while (state.loading.hasMoreBefore && !abortSearchRef.current) {
          if (!isMountedRef.current) return { found: false, messageId: null };

          const prevCount = state.messages.length;
          loadMoreBeforeMessage();

          const loaded = await waitForBeforeLoadComplete(prevCount);
          if (!loaded || abortSearchRef.current || !isMountedRef.current) break;

          state = useChatRoomRuntimeStore.getState();
          currentMessages = state.messages;
          results = findSearchResults(currentMessages, keyword);

          if (results.length > 0) {
            const lastResultIndex = results[results.length - 1];
            const messageId = currentMessages[lastResultIndex]?.id ?? null;
            setFocusedMessageId(messageId);
            setCurrentSearchIndex(results.length - 1);
            scrollToMessageIndex(lastResultIndex);
            return { found: true, messageId };
          }
        }

        if (isMountedRef.current) {
          setFocusedMessageId(null);
          setCurrentSearchIndex(0);
        }
        return { found: false, messageId: null };
      } finally {
        if (isMountedRef.current) setIsSearching(false);
      }
    },
    [loadMoreBeforeMessage, scrollToMessageIndex, setFocusedMessageId, setCurrentSearchIndex, setIsSearching],
  );

  const handleSearchSubmit = useCallback(
    async (keyword: string) => {
      if (!keyword.trim()) return;
      setActiveSearchKeyword(keyword);
      setSearchKeyword(keyword);
      await executeInfiniteSearch(keyword);
    },
    [setActiveSearchKeyword, setSearchKeyword, executeInfiniteSearch],
  );

  const canGoPrev = useMemo(() => {
    if (searchResults.length === 0) return false;
    return currentIndex > 0 || hasMoreBefore;
  }, [searchResults.length, currentIndex, hasMoreBefore]);

  const goToPrevious = useCallback(async () => {
    if (isNavigatingRef.current || searchResults.length === 0 || !isMountedRef.current) return;
    isNavigatingRef.current = true;

    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const messageIndex = searchResults[prevIndex];
      const messageId = messages[messageIndex]?.id ?? null;
      setFocusedMessageId(messageId);
      setCurrentSearchIndex(prevIndex);
      scrollToMessageIndex(messageIndex);
      setTimeout(() => { isNavigatingRef.current = false; }, NAVIGATION_COOLDOWN);
      return;
    }

    if (hasMoreBefore && activeSearchKeyword) {
      abortSearchRef.current = false;
      setIsSearching(true);
      try {
        const currentFocusedId = focusedMessageId;
        let state = useChatRoomRuntimeStore.getState();

        while (state.loading.hasMoreBefore && !abortSearchRef.current && isMountedRef.current) {
          const prevMessageCount = state.messages.length;
          loadMoreBeforeMessage();
          const loaded = await waitForBeforeLoadComplete(prevMessageCount);
          if (!loaded || abortSearchRef.current || !isMountedRef.current) break;

          state = useChatRoomRuntimeStore.getState();
          const newMessages = state.messages;
          const newResults = findSearchResults(newMessages, activeSearchKeyword);

          if (newResults.length > 0) {
            let newCurrentIndex = -1;
            if (currentFocusedId) {
              const prevFocusedMsgIndex = newMessages.findIndex(m => m.id === currentFocusedId);
              if (prevFocusedMsgIndex !== -1) {
                newCurrentIndex = newResults.indexOf(prevFocusedMsgIndex);
              }
            }
            if (newCurrentIndex > 0 && isMountedRef.current) {
              const prevIdx = newCurrentIndex - 1;
              const messageIndex = newResults[prevIdx];
              const messageId = newMessages[messageIndex]?.id ?? null;
              setFocusedMessageId(messageId);
              setCurrentSearchIndex(prevIdx);
              scrollToMessageIndex(messageIndex);
              break;
            } else if (newCurrentIndex === -1 && newResults.length > 0 && isMountedRef.current) {
              const lastResultIndex = newResults[newResults.length - 1];
              const messageId = newMessages[lastResultIndex]?.id ?? null;
              setFocusedMessageId(messageId);
              setCurrentSearchIndex(newResults.length - 1);
              scrollToMessageIndex(lastResultIndex);
              break;
            }
          }
        }
      } finally {
        if (isMountedRef.current) setIsSearching(false);
        setTimeout(() => { isNavigatingRef.current = false; }, NAVIGATION_COOLDOWN);
      }
    } else {
      isNavigatingRef.current = false;
    }
  }, [
    currentIndex, searchResults, messages, hasMoreBefore, activeSearchKeyword,
    focusedMessageId, loadMoreBeforeMessage, setFocusedMessageId,
    setCurrentSearchIndex, setIsSearching, scrollToMessageIndex,
  ]);

  const canGoNext = useMemo(() => {
    if (searchResults.length === 0) return false;
    return currentIndex < searchResults.length - 1;
  }, [searchResults.length, currentIndex]);

  const goToNext = useCallback(() => {
    if (isNavigatingRef.current || searchResults.length === 0 || !isMountedRef.current) return;
    if (currentIndex >= searchResults.length - 1) return;

    isNavigatingRef.current = true;
    const nextIndex = currentIndex + 1;
    const messageIndex = searchResults[nextIndex];
    const messageId = messages[messageIndex]?.id ?? null;

    setFocusedMessageId(messageId);
    setCurrentSearchIndex(nextIndex);
    scrollToMessageIndex(messageIndex);

    setTimeout(() => { isNavigatingRef.current = false; }, NAVIGATION_COOLDOWN);
  }, [currentIndex, searchResults, messages, setFocusedMessageId, setCurrentSearchIndex, scrollToMessageIndex]);

  useEffect(() => {
    if (!isSearchMode) {
      abortSearchRef.current = true;
      isNavigatingRef.current = false;
    }
  }, [isSearchMode]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortSearchRef.current = true;
      isNavigatingRef.current = false;
    };
  }, []);

  const displayIndex = useMemo(() => {
    if (searchResults.length === 0) return 0;
    return searchResults.length - currentIndex;
  }, [searchResults.length, currentIndex]);

  return {
    isSearchMode,
    searchKeyword,
    isSearching,
    searchResults,
    currentIndex,
    displayIndex,
    totalCount: searchResults.length,
    focusedMessageId,
    canGoPrev,
    canGoNext,
    enterSearchMode,
    exitSearchMode,
    handleSearchKeywordChange,
    handleSearchSubmit,
    goToPrevious,
    goToNext,
  };
}
