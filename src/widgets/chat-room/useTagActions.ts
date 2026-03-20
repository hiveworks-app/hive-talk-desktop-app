'use client';

import { useCallback, useEffect } from 'react';
import type { ChatMessageUI } from '@/shared/types/websocket';
import { isOffline } from '@/shared/utils/offlineGuard';
import { useAuthStore } from '@/store/auth/authStore';
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

      if (addedTagIds.length > 0) {
        addTagToMessage({ messageId: tagSelectedMessage.id, tagIdList: addedTagIds });
      }
      if (removedTagIds.length > 0) {
        const removedTagIdSet = new Set(removedTagIds);
        const taggingIdList = tagSelectedMessage.originalTags
          .filter(t => removedTagIdSet.has(String(t.tagId)))
          .map(t => String(t.taggingId))
          .filter(Boolean);
        if (taggingIdList.length > 0) {
          removeTagFromMessage({ messageId: tagSelectedMessage.id, taggingIdList });
        }
      }
      resetSelectedTags();
      closeTagPanel();
    }
  }, [tagActionType, tagSelectedMessage, selectedTags, addTagToMessage, removeTagFromMessage, resetSelectedTags, closeTagPanel]);

  const handleSendWithTags = useCallback((content: string) => {
    const tagList = selectedTags.map(t => String(t.tagId));
    sendTextMessage(content, tagList);
    if (tagList.length > 0) {
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
