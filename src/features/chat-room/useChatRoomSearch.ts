'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { findSearchResults, useSearchInfiniteLoader } from './useSearchInfiniteLoader';

interface UseChatRoomSearchOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  loadMoreBeforeMessage: () => void;
}

export interface UseChatRoomSearchReturn {
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

export function useChatRoomSearch({ containerRef, loadMoreBeforeMessage }: UseChatRoomSearchOptions): UseChatRoomSearchReturn {
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

  const scrollToMessageIndex = useCallback((messageIndex: number) => {
    if (!isMountedRef.current || !containerRef.current) return;
    requestAnimationFrame(() => {
      if (!isMountedRef.current || !containerRef.current) return;
      const el = containerRef.current.querySelector(`[data-msg-index="${messageIndex}"]`);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [containerRef]);

  const { executeInfiniteSearch, goToPrevious: goToPreviousInternal } = useSearchInfiniteLoader({
    loadMoreBeforeMessage, scrollToMessageIndex,
    setFocusedMessageId, setCurrentSearchIndex, setIsSearching,
    abortSearchRef, isNavigatingRef, isMountedRef,
  });

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
  const exitSearchMode = useCallback(() => { abortSearchRef.current = true; setIsSearchMode(false); }, [setIsSearchMode]);
  const handleSearchKeywordChange = useCallback((keyword: string) => setSearchKeyword(keyword), [setSearchKeyword]);

  const handleSearchSubmit = useCallback(async (keyword: string) => {
    if (!keyword.trim()) return;
    setActiveSearchKeyword(keyword);
    setSearchKeyword(keyword);
    await executeInfiniteSearch(keyword);
  }, [setActiveSearchKeyword, setSearchKeyword, executeInfiniteSearch]);

  const canGoPrev = useMemo(() => searchResults.length > 0 && (currentIndex > 0 || hasMoreBefore), [searchResults.length, currentIndex, hasMoreBefore]);
  const canGoNext = useMemo(() => searchResults.length > 0 && currentIndex < searchResults.length - 1, [searchResults.length, currentIndex]);

  const goToPrevious = useCallback(() => {
    goToPreviousInternal(currentIndex, searchResults, messages, hasMoreBefore, activeSearchKeyword, focusedMessageId);
  }, [goToPreviousInternal, currentIndex, searchResults, messages, hasMoreBefore, activeSearchKeyword, focusedMessageId]);

  const goToNext = useCallback(() => {
    if (isNavigatingRef.current || searchResults.length === 0 || !isMountedRef.current) return;
    if (currentIndex >= searchResults.length - 1) return;
    isNavigatingRef.current = true;
    const nextIndex = currentIndex + 1;
    const messageIndex = searchResults[nextIndex];
    setFocusedMessageId(messages[messageIndex]?.id ?? null);
    setCurrentSearchIndex(nextIndex);
    scrollToMessageIndex(messageIndex);
    setTimeout(() => { isNavigatingRef.current = false; }, NAVIGATION_COOLDOWN);
  }, [currentIndex, searchResults, messages, setFocusedMessageId, setCurrentSearchIndex, scrollToMessageIndex]);

  useEffect(() => {
    if (!isSearchMode) { abortSearchRef.current = true; isNavigatingRef.current = false; }
  }, [isSearchMode]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; abortSearchRef.current = true; isNavigatingRef.current = false; };
  }, []);

  const displayIndex = useMemo(() => (searchResults.length === 0 ? 0 : searchResults.length - currentIndex), [searchResults.length, currentIndex]);

  return {
    isSearchMode, searchKeyword, isSearching, searchResults,
    currentIndex, displayIndex, totalCount: searchResults.length,
    focusedMessageId, canGoPrev, canGoNext,
    enterSearchMode, exitSearchMode, handleSearchKeywordChange,
    handleSearchSubmit, goToPrevious, goToNext,
  };
}
