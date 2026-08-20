'use client';

import { useCallback, type MutableRefObject } from 'react';
import { ChatMessageUI, WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { extractFileName } from '@/shared/utils/fileUtils';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';

export function findSearchResults(messages: ChatMessageUI[], keyword: string): number[] {
  if (!keyword.trim()) return [];
  const lowerKeyword = keyword.toLowerCase();
  const results: number[] = [];
  messages.forEach((msg, index) => {
    if (msg.isDeleted) return;

    // TEXT 메시지: 본문에서 검색
    if (msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.TEXT) {
      if (msg.text.toLowerCase().includes(lowerKeyword)) results.push(index);
      return;
    }

    // FILE 메시지: 파일명에서 검색 (RN 패리티) — 검색에 걸리는 글자 = 화면 표시 글자가
    // 일치하도록 ChatFileCard와 동일하게 extractFileName(file.path)로 파일명을 뽑는다.
    // 비디오·파일은 메시지당 1개씩만 전송되므로 files[0]만 검사한다.
    if (msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE) {
      const file = msg.files?.[0];
      if (file && extractFileName(file.path ?? '').toLowerCase().includes(lowerKeyword)) {
        results.push(index);
      }
    }
  });
  return results;
}

async function waitForBeforeLoadComplete(prevMessageCount: number, timeout = 10000): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 50));
  return new Promise(resolve => {
    const startTime = Date.now();
    const check = () => {
      const state = useChatRoomRuntimeStore.getState();
      const messagesUpdated = state.messages.length > prevMessageCount;
      const noMoreMessages = !state.loading.hasMoreBefore;
      const loadingComplete = !state.loading.isBeforeLoading;
      if (loadingComplete && (messagesUpdated || noMoreMessages)) { resolve(true); return; }
      if (Date.now() - startTime > timeout) { resolve(false); return; }
      setTimeout(check, 100);
    };
    check();
  });
}

interface SearchLoaderDeps {
  loadMoreBeforeMessage: () => void;
  scrollToMessageIndex: (index: number) => void;
  setFocusedMessageId: (id: string | null) => void;
  setCurrentSearchIndex: (index: number) => void;
  setIsSearching: (v: boolean) => void;
  abortSearchRef: MutableRefObject<boolean>;
  isNavigatingRef: MutableRefObject<boolean>;
  isMountedRef: MutableRefObject<boolean>;
}

export function useSearchInfiniteLoader(deps: SearchLoaderDeps) {
  const {
    loadMoreBeforeMessage, scrollToMessageIndex,
    setFocusedMessageId, setCurrentSearchIndex, setIsSearching,
    abortSearchRef, isNavigatingRef, isMountedRef,
  } = deps;

  const NAVIGATION_COOLDOWN = 300;

  const executeInfiniteSearch = useCallback(
    async (keyword: string): Promise<{ found: boolean; messageId: string | null }> => {
      abortSearchRef.current = false;
      setIsSearching(true);
      try {
        let currentMessages = useChatRoomRuntimeStore.getState().messages;
        let results = findSearchResults(currentMessages, keyword);
        if (!isMountedRef.current) return { found: false, messageId: null };

        if (results.length > 0) {
          const lastIdx = results[results.length - 1];
          const messageId = currentMessages[lastIdx]?.id ?? null;
          setFocusedMessageId(messageId);
          setCurrentSearchIndex(results.length - 1);
          scrollToMessageIndex(lastIdx);
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
            const lastIdx = results[results.length - 1];
            const messageId = currentMessages[lastIdx]?.id ?? null;
            setFocusedMessageId(messageId);
            setCurrentSearchIndex(results.length - 1);
            scrollToMessageIndex(lastIdx);
            return { found: true, messageId };
          }
        }

        if (isMountedRef.current) { setFocusedMessageId(null); setCurrentSearchIndex(0); }
        return { found: false, messageId: null };
      } finally {
        if (isMountedRef.current) setIsSearching(false);
      }
    },
    [loadMoreBeforeMessage, scrollToMessageIndex, setFocusedMessageId, setCurrentSearchIndex, setIsSearching, abortSearchRef, isMountedRef],
  );

  const goToPrevious = useCallback(
    async (currentIndex: number, searchResults: number[], messages: ChatMessageUI[], hasMoreBefore: boolean, activeSearchKeyword: string, focusedMessageId: string | null) => {
      if (isNavigatingRef.current || searchResults.length === 0 || !isMountedRef.current) return;
      isNavigatingRef.current = true;

      if (currentIndex > 0) {
        const prevIndex = currentIndex - 1;
        const messageIndex = searchResults[prevIndex];
        setFocusedMessageId(messages[messageIndex]?.id ?? null);
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
            const prevCount = state.messages.length;
            loadMoreBeforeMessage();
            const loaded = await waitForBeforeLoadComplete(prevCount);
            if (!loaded || abortSearchRef.current || !isMountedRef.current) break;

            state = useChatRoomRuntimeStore.getState();
            const newMessages = state.messages;
            const newResults = findSearchResults(newMessages, activeSearchKeyword);

            if (newResults.length > 0) {
              let newCurrentIndex = -1;
              if (currentFocusedId) {
                const prevFocusedIdx = newMessages.findIndex(m => m.id === currentFocusedId);
                if (prevFocusedIdx !== -1) newCurrentIndex = newResults.indexOf(prevFocusedIdx);
              }
              if (newCurrentIndex > 0 && isMountedRef.current) {
                const prevIdx = newCurrentIndex - 1;
                setFocusedMessageId(newMessages[newResults[prevIdx]]?.id ?? null);
                setCurrentSearchIndex(prevIdx);
                scrollToMessageIndex(newResults[prevIdx]);
                break;
              } else if (newCurrentIndex === -1 && newResults.length > 0 && isMountedRef.current) {
                const lastIdx = newResults[newResults.length - 1];
                setFocusedMessageId(newMessages[lastIdx]?.id ?? null);
                setCurrentSearchIndex(newResults.length - 1);
                scrollToMessageIndex(lastIdx);
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
    },
    [loadMoreBeforeMessage, scrollToMessageIndex, setFocusedMessageId, setCurrentSearchIndex, setIsSearching, abortSearchRef, isNavigatingRef, isMountedRef],
  );

  return { executeInfiniteSearch, goToPrevious };
}
