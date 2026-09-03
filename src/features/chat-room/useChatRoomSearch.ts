'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { findSearchResults, useSearchInfiniteLoader } from './useSearchInfiniteLoader';

interface UseChatRoomSearchOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  loadMoreBeforeMessage: () => void;
}

export interface UseChatRoomSearchReturn {
  isSearchMode: boolean;
  searchKeyword: string;
  /** 실제 검색이 실행된 키워드 — 입력 중 키워드와 비교해 "엔터=다음 결과" 판정 (2026-09-03) */
  activeSearchKeyword: string;
  isSearching: boolean;
  /** 검색을 완주했는지 — '검색결과 없음' 표시 조건 */
  hasSearched: boolean;
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

  // 검색 상한 경계 — 제출 시점의 최신 메시지 시각. 검색 진행 중 도착한 새 메시지가
  // 결과 집합에 섞여 인덱스/총건수가 흔들리는 것을 방지 (RN SearchUpperBound 패리티)
  const [searchBoundary, setSearchBoundary] = useState<number | null>(null);
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
    const boundary = searchBoundary;
    const results = findSearchResults(messages, activeSearchKeyword);
    if (boundary == null) return results;
    // 경계 이후 도착분 제외 — 과거 페이지 로드는 경계보다 오래된 메시지라 영향 없음
    return results.filter(idx => {
      const createdAt = Date.parse(messages[idx]?.createdAt ?? '');
      return !createdAt || createdAt <= boundary;
    });
  }, [activeSearchKeyword, messages, isSearchMode, searchBoundary]);

  const currentIndex = useMemo(() => {
    if (!focusedMessageId || searchResults.length === 0) return 0;
    const messageIndex = messages.findIndex(m => m.id === focusedMessageId);
    if (messageIndex === -1) return 0;
    const resultIndex = searchResults.indexOf(messageIndex);
    return resultIndex !== -1 ? resultIndex : 0;
  }, [focusedMessageId, searchResults, messages]);

  const enterSearchMode = useCallback(() => setIsSearchMode(true), [setIsSearchMode]);
  const exitSearchMode = useCallback(() => { abortSearchRef.current = true; setSearchBoundary(null); setIsSearchMode(false); }, [setIsSearchMode]);
  const handleSearchKeywordChange = useCallback((keyword: string) => setSearchKeyword(keyword), [setSearchKeyword]);

  const handleSearchSubmit = useCallback(async (keyword: string) => {
    if (!keyword.trim()) return;
    // NFC 정규화 — NFD 파일명·복사 텍스트와의 자소 분리 불일치 해소 (RN C11 패리티)
    const normalizedKeyword = keyword.normalize('NFC');
    // 제출 시점 최신 메시지를 상한 경계로 고정 (재검색 시 갱신)
    const latest = useChatRoomRuntimeStore.getState().messages;
    setSearchBoundary(latest.length > 0 ? Date.parse(latest[latest.length - 1].createdAt) || Date.now() : Date.now());
    setActiveSearchKeyword(normalizedKeyword);
    setSearchKeyword(normalizedKeyword);
    await executeInfiniteSearch(normalizedKeyword);
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
    isSearchMode, searchKeyword, activeSearchKeyword, isSearching, searchResults,
    // 검색을 완주했는지 — '검색결과 없음' 표시 조건 (검색 전/취소와 0건 완주를 구분, RN C5 패리티)
    hasSearched: activeSearchKeyword.trim().length > 0,
    currentIndex, displayIndex, totalCount: searchResults.length,
    focusedMessageId, canGoPrev, canGoNext,
    enterSearchMode, exitSearchMode, handleSearchKeywordChange,
    handleSearchSubmit, goToPrevious, goToNext,
  };
}
