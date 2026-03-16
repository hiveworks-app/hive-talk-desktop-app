'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseScrollManagementOptions {
  messagesLength: number;
  isRoomTransitioning: boolean;
  storeRoomId: string;
  initialNotReadCount: number;
  scrollToBottomTrigger: number;
  hasMoreBefore: boolean;
  isBeforeLoading: boolean;
  loadMoreBeforeMessage: (direction: 'before') => void;
}

const UNREAD_SEPARATOR_THRESHOLD = 20;

export function useScrollManagement({
  messagesLength,
  isRoomTransitioning,
  storeRoomId,
  initialNotReadCount,
  scrollToBottomTrigger,
  hasMoreBefore,
  isBeforeLoading,
  loadMoreBeforeMessage,
}: UseScrollManagementOptions) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(initialNotReadCount === 0);
  const prevScrollHeightRef = useRef(0);
  const isInitialLoadRef = useRef(true);
  const canDismissSeparatorRef = useRef(false);

  // 구분선 표시: roomId 기반으로 추적
  const [dismissedRoomId, setDismissedRoomId] = useState<string | null>(null);
  const showUnreadSeparator = initialNotReadCount >= UNREAD_SEPARATOR_THRESHOLD && dismissedRoomId !== storeRoomId;

  // 방 변경 시 스크롤 상태 리셋
  useEffect(() => {
    isInitialLoadRef.current = true;
    isNearBottomRef.current = initialNotReadCount === 0;
    canDismissSeparatorRef.current = false;
  }, [storeRoomId]);

  // 메시지 로드 후 스크롤 위치 결정
  useEffect(() => {
    if (messagesLength === 0 || isRoomTransitioning) return;

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;

      if (initialNotReadCount === 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        isNearBottomRef.current = true;
      } else {
        const separator = document.getElementById('unread-separator');
        if (separator) {
          separator.scrollIntoView({ behavior: 'auto', block: 'center' });
          setTimeout(() => { canDismissSeparatorRef.current = true; }, 500);
        } else {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          isNearBottomRef.current = true;
        }
      }
      return;
    }

    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesLength, isRoomTransitioning]);

  useEffect(() => {
    if (scrollToBottomTrigger > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scrollToBottomTrigger]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
    isNearBottomRef.current = nearBottom;

    if (nearBottom && canDismissSeparatorRef.current) {
      setDismissedRoomId(storeRoomId);
    }

    if (scrollTop < 50 && hasMoreBefore && !isBeforeLoading) {
      prevScrollHeightRef.current = scrollHeight;
      loadMoreBeforeMessage('before');
    }
  }, [hasMoreBefore, isBeforeLoading, loadMoreBeforeMessage, storeRoomId]);

  // 이전 메시지 로드 시 스크롤 위치 보존
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || prevScrollHeightRef.current === 0) return;

    const newScrollHeight = container.scrollHeight;
    const diff = newScrollHeight - prevScrollHeightRef.current;
    if (diff > 0) {
      container.scrollTop += diff;
    }
    prevScrollHeightRef.current = 0;
  }, [messagesLength]);

  // 이미지 로드 등으로 콘텐츠 높이가 변할 때 하단 유지
  useEffect(() => {
    const content = messagesContentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(() => {
      const container = messagesContainerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const gap = scrollHeight - scrollTop - clientHeight;

      if (gap < 300 || isNearBottomRef.current) {
        container.scrollTop = scrollHeight;
      }
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return {
    messagesEndRef,
    messagesContainerRef,
    messagesContentRef,
    handleScroll,
    showUnreadSeparator,
  };
}
