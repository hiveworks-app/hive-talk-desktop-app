'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { exceedsViewportHeight } from '@/features/chat-room/unreadSeparatorUtils';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';

interface UseScrollManagementOptions {
  messagesLength: number;
  isRoomTransitioning: boolean;
  storeRoomId: string;
  initialNotReadCount: number;
  scrollToBottomTrigger: number;
  hasMoreBefore: boolean;
  isBeforeLoading: boolean;
  loadMoreBeforeMessage: (direction: 'before') => void;
  /** 마지막 도착 메시지가 시스템 메시지(입장/퇴장/공지 등)인지 — '새 메시지 보기' 미유발 (RN 패리티) */
  lastMessageIsSystem?: boolean;
}


export function useScrollManagement({
  messagesLength,
  isRoomTransitioning,
  storeRoomId,
  initialNotReadCount,
  scrollToBottomTrigger,
  hasMoreBefore,
  isBeforeLoading,
  loadMoreBeforeMessage,
  lastMessageIsSystem = false,
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
  // 하단 이탈/새 메시지 도착 상태 — '새 메시지 보기' 플로팅 버튼용 (RN NewMessageButton 패리티)
  const [isAwayFromBottom, setIsAwayFromBottom] = useState(false);
  const [hasNewWhileAway, setHasNewWhileAway] = useState(false);

  // 컨테이너 실측 높이 — 렌더 중 ref 접근 금지 규칙 준수를 위해 effect에서 상태로 반영
  const [viewportHeight, setViewportHeight] = useState(600);
  useEffect(() => {
    const timer = setTimeout(() => {
      const h = messagesContainerRef.current?.clientHeight;
      if (h && h > 0) setViewportHeight(h);
    }, 0);
    return () => clearTimeout(timer);
  }, [storeRoomId, messagesLength]);

  // 안읽은 메시지의 예상 높이가 뷰포트를 넘을 때만 구분선 표시 (RN exceedsViewportHeight 패리티 —
  // 고정 20건 임계 대신 타입별 높이 추정으로 5~8건부터도 한 화면 밖이면 표시)
  const showUnreadSeparator = useMemo(() => {
    if (initialNotReadCount <= 0 || dismissedRoomId === storeRoomId) return false;
    const messages = useChatRoomRuntimeStore.getState().messages;
    if (messages.length === 0) return false;
    const unread = messages.slice(-Math.min(initialNotReadCount, messages.length));
    return exceedsViewportHeight(unread, viewportHeight, 0);
    // messagesLength 의존 — 초기 FETCH 도착 후 재판정
  }, [initialNotReadCount, dismissedRoomId, storeRoomId, messagesLength, viewportHeight]);

  // 방 변경 시 스크롤 상태 리셋
  useEffect(() => {
    isInitialLoadRef.current = true;
    isNearBottomRef.current = initialNotReadCount === 0;
    canDismissSeparatorRef.current = false;
    // 버튼 상태 리셋 — 동기 setState 금지 규칙 준수를 위해 비동기 콜백에서 수행
    const timer = setTimeout(() => {
      setIsAwayFromBottom(false);
      setHasNewWhileAway(false);
    }, 0);
    return () => clearTimeout(timer);
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
    } else if (prevScrollHeightRef.current === 0 && !lastMessageIsSystem) {
      // 위로 스크롤해 둔 상태에서 새 메시지 도착 (과거 페이지 prepend 제외) → '새 메시지 보기' 강조.
      // 시스템 메시지(입장/퇴장/공지 등)는 강조하지 않음 (RN NewMessageButton 패리티)
      const timer = setTimeout(() => setHasNewWhileAway(true), 0);
      return () => clearTimeout(timer);
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
    setIsAwayFromBottom(!nearBottom);
    if (nearBottom) setHasNewWhileAway(false);

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

  // '새 메시지 보기'/맨아래 버튼 클릭 — 최하단 이동 + 강조 해제
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setHasNewWhileAway(false);
  }, []);

  return {
    messagesEndRef,
    messagesContainerRef,
    messagesContentRef,
    handleScroll,
    showUnreadSeparator,
    isAwayFromBottom,
    hasNewWhileAway,
    scrollToBottom,
  };
}
