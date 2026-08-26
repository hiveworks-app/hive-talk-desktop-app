'use client';

import { useCallback, useEffect } from 'react';
import type { ChatMessageUI } from '@/shared/types/websocket';
import { isOffline } from '@/shared/utils/offlineGuard';
import { useAuthStore } from '@/store/auth/authStore';
import { pendingTagUpdateRegistry } from '@/features/chat-room/pendingTagUpdateRegistry';
import { useRecentTagUsageStore } from '@/store/tag/recentTagUsageStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useSelectedTagStore, useTagStore } from '@/store/tag/tagStore';

interface UseTagActionsOptions {
  roomId: string;
  sendTextMessage: (content: string, tagList?: string[]) => void;
  addTagToMessage: (params: { messageId: string; tagIdList: string[] }) => void;
  removeTagFromMessage: (params: { messageId: string; taggingIdList: string[] }) => void;
}

export function useTagActions({
  roomId,
  sendTextMessage,
  addTagToMessage,
  removeTagFromMessage,
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
      const taggingIdList = tagSelectedMessage.originalTags
        .filter(t => removedTagIdSet.has(String(t.tagId)))
        .map(t => String(t.taggingId))
        .filter(Boolean);
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
      resetSelectedTags();
      closeTagPanel();
    }
  }, [tagActionType, tagSelectedMessage, selectedTags, addTagToMessage, removeTagFromMessage, resetSelectedTags, closeTagPanel]);

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
