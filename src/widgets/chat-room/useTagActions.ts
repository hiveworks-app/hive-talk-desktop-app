'use client';

import { useCallback, useEffect } from 'react';
import type { ChatMessageUI } from '@/shared/types/websocket';
import { isOffline } from '@/shared/utils/offlineGuard';
import { useAuthStore } from '@/store/auth/authStore';
import { optimisticTagRemoveGuard } from '@/features/chat-room/optimisticTagRemoveGuard';
import { isConfirmedTaggingId, pendingTagRemoveRegistry } from '@/features/chat-room/pendingTagRemoveRegistry';
import { pendingTagUpdateRegistry } from '@/features/chat-room/pendingTagUpdateRegistry';
import { useRecentTagUsageStore } from '@/store/tag/recentTagUsageStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useSelectedTagStore, useTagStore } from '@/store/tag/tagStore';
import { useUIStore } from '@/store/uiStore';

interface UseTagActionsOptions {
  roomId: string;
  sendTextMessage: (content: string, tagList?: string[]) => void;
  addTagToMessage: (params: { messageId: string; tagIdList: string[] }) => void;
  removeTagFromMessage: (params: { messageId: string; taggingIdList: string[] }) => void;
  /** 미확정 taggingId(-1) 해소용 재조회 — 해제 예약 후 호출해 확정값 도착을 앞당긴다 */
  refreshMessageTags: (messageId: string) => void;
}

export function useTagActions({
  roomId,
  sendTextMessage,
  addTagToMessage,
  removeTagFromMessage,
  refreshMessageTags,
}: UseTagActionsOptions) {
  const { isTagOpen, tagActionType, selectedMessage: tagSelectedMessage, openAddMode, openUpdateMode, closeTagPanel } = useTagStore();
  const { selectedTags, resetSelectedTags } = useSelectedTagStore();

  // 채팅방 변경 시 태그 패널 닫기
  useEffect(() => {
    closeTagPanel();
    resetSelectedTags();
  }, [roomId]);

  const handleOpenAddTag = useCallback(() => {
    openAddMode();
  }, [openAddMode]);

  const handleOpenUpdateTag = useCallback((message: ChatMessageUI) => {
    if (isOffline()) return;
    openUpdateMode(message);
  }, [openUpdateMode]);

  const handleTagConfirm = useCallback(() => {
    if (tagActionType === 'ADD') {
      closeTagPanel();
    } else if (tagActionType === 'UPDATE' && tagSelectedMessage) {
      const originalTagIds = new Set(tagSelectedMessage.tagsId);
      const currentTagIds = selectedTags.map(t => String(t.tagId));
      const currentTagIdSet = new Set(currentTagIds);

      const addedTagIds = currentTagIds.filter(id => !originalTagIds.has(id));
      const removedTagIds = [...originalTagIds].filter(id => !currentTagIdSet.has(id));

      if (addedTagIds.length > 0 || removedTagIds.length > 0) {
        const myUserId = String(useAuthStore.getState().user?.id ?? '');
        const normalizedTags = selectedTags.map(t => ({
          ...t,
          tagId: Number(t.tagId),
          categoryId: Number(t.categoryId),
          userId: t.userId ?? myUserId,
        }));
        useChatRoomRuntimeStore
          .getState()
          .setMessages(prev =>
            prev.map(m => (m.id === tagSelectedMessage.id ? { ...m, tags: normalizedTags } : m)),
          );
      }

      // 최근 사용 태그 기록 — 태그 시트 완료도 기록 경로 (RN 3경로 패리티)
      if (addedTagIds.length > 0) {
        const addedIdSet = new Set(addedTagIds);
        selectedTags
          .filter(t => addedIdSet.has(String(t.tagId)))
          .forEach(t => useRecentTagUsageStore.getState().record(t.title));
      }

      const removedTagIdSet = new Set(removedTagIds);
      const removedOriginalTags = tagSelectedMessage.originalTags.filter(t =>
        removedTagIdSet.has(String(t.tagId)),
      );
      // 전송 직후 PUB 에코의 taggingId는 -1 플레이스홀더 — 확정된 것만 즉시 REMOVE,
      // 미확정분은 확정 브로드캐스트 도착 시 발사하도록 예약 (2026-08-27 QA)
      const taggingIdList = removedOriginalTags
        .filter(t => isConfirmedTaggingId(t.taggingId))
        .map(t => String(t.taggingId));
      const unconfirmedRemovals = removedOriginalTags.filter(t => !isConfirmedTaggingId(t.taggingId));
      unconfirmedRemovals.forEach(t =>
        pendingTagRemoveRegistry.mark(tagSelectedMessage.id, Number(t.tagId), list =>
          removeTagFromMessage({ messageId: tagSelectedMessage.id, taggingIdList: list }),
        ),
      );
      // 서버는 확정 브로드캐스트를 안 주므로(실측) 재조회로 확정 taggingId 도착을 앞당긴다
      if (unconfirmedRemovals.length > 0) refreshMessageTags(tagSelectedMessage.id);
      const hasRemove = taggingIdList.length > 0;
      const hasAdd = addedTagIds.length > 0;

      if (hasRemove && hasAdd) {
        // 서버는 ADD/REMOVE 순서를 보장하지 않아 ADD가 먼저 처리되면 3개 한도 초과(TA003)로
        // reject된다 — REMOVE 브로드캐스트 도착 후 ADD 발사 (RN 패리티)
        pendingTagUpdateRegistry.mark(tagSelectedMessage.id, addedTagIds, tagIdList =>
          addTagToMessage({ messageId: tagSelectedMessage.id, tagIdList }),
        );
        removeTagFromMessage({ messageId: tagSelectedMessage.id, taggingIdList });
      } else {
        if (hasAdd) addTagToMessage({ messageId: tagSelectedMessage.id, tagIdList: addedTagIds });
        if (hasRemove) removeTagFromMessage({ messageId: tagSelectedMessage.id, taggingIdList });
      }

      // 실패 안전망 — 순수 해제(추가 없음)일 때, 제한 시간 내 REMOVE 브로드캐스트가 없으면
      // 스냅샷 복구 + 안내 (2026-08-27 UX 결정: 즉시 제거 + 실패 시 안내 복구)
      if ((hasRemove || unconfirmedRemovals.length > 0) && !hasAdd) {
        const messageId = tagSelectedMessage.id;
        const snapshotTags = tagSelectedMessage.originalTags;
        optimisticTagRemoveGuard.arm(messageId, () => {
          pendingTagRemoveRegistry.cancel(messageId);
          useChatRoomRuntimeStore
            .getState()
            .setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, tags: snapshotTags } : m)));
          useUIStore.getState().showSnackbar({ message: '태그 해제에 실패했어요. 잠시 후 다시 시도해주세요.', state: 'error' });
        });
      }
      resetSelectedTags();
      closeTagPanel();
    }
  }, [tagActionType, tagSelectedMessage, selectedTags, addTagToMessage, removeTagFromMessage, refreshMessageTags, resetSelectedTags, closeTagPanel]);

  const handleSendWithTags = useCallback((content: string) => {
    const tagList = selectedTags.map(t => String(t.tagId));
    sendTextMessage(content, tagList);
    if (tagList.length > 0) {
      // 최근 사용 태그 기록 — 태그 달아 전송도 기록 경로 (RN 패리티)
      selectedTags.forEach(t => useRecentTagUsageStore.getState().record(t.title));
      resetSelectedTags();
    }
  }, [sendTextMessage, selectedTags, resetSelectedTags]);

  return {
    isTagOpen,
    handleOpenAddTag,
    handleOpenUpdateTag,
    handleTagConfirm,
    handleSendWithTags,
  };
}
