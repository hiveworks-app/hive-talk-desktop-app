'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import { useGetTagInfo } from '@/features/tag/queries';
import { cn } from '@/shared/lib/cn';
import type { TagListType } from '@/shared/types/tag';
import { IconCloseFilled } from '@/shared/ui/icons';
import { WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { TagChip } from '@/shared/ui/TagChip';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useSelectedTagStore, useTagStore } from '@/store/tag/tagStore';
import { useUIStore } from '@/store/uiStore';

interface TagSelectPanelProps {
  onConfirm?: () => void;
}

function TagSelectPanelComponent({ onConfirm }: TagSelectPanelProps) {
  const { tagCategory: categories, tagList: tags, isLoading } = useGetTagInfo();
  const { tagActionType, selectedMessage, closeTagPanel } = useTagStore();
  const { selectedTags, toggleTag, resetSelectedTags } = useSelectedTagStore();
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const loginUserId = useAuthStore(s => s.user?.id);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);

  // 첫 카테고리 자동 선택
  const activeCategoryId = useMemo(() => {
    if (!categories?.length) return 0;
    const exists = categories.some(c => c.categoryId === selectedCategoryId);
    return exists ? selectedCategoryId : categories[0].categoryId;
  }, [categories, selectedCategoryId]);

  // 카테고리별 태그 필터
  const filteredTags = useMemo(
    () => (tags ?? []).filter(tag => tag.categoryId === activeCategoryId),
    [tags, activeCategoryId],
  );

  // 선택된 태그 ID Set
  const selectedIdSet = useMemo(
    () => new Set(selectedTags.map(t => Number(t.tagId))),
    [selectedTags],
  );

  // UPDATE 모드: 다른 사용자 태그 ID Set (삭제 불가)
  const otherUserTagIdSet = useMemo(() => {
    if (tagActionType !== 'UPDATE' || !loginUserId) return new Set<number>();
    return new Set(
      selectedTags
        .filter(t => t.userId && String(t.userId) !== String(loginUserId))
        .map(t => Number(t.tagId)),
    );
  }, [tagActionType, loginUserId, selectedTags]);

  // UPDATE 모드 메시지 미리보기
  const previewText = useMemo(() => {
    if (tagActionType !== 'UPDATE' || !selectedMessage) return null;
    const messages = useChatRoomRuntimeStore.getState().messages;
    const msg = messages.find(m => m.id === selectedMessage.id);
    if (!msg) return null;
    if (msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.IMAGE) return '사진';
    if (msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.MEDIA) return '동영상';
    if (msg.messageContentType === WS_MESSAGE_CONTENT_TYPE.FILE) return '파일';
    return msg.text || null;
  }, [tagActionType, selectedMessage]);

  const previewSender = useMemo(() => {
    if (!selectedMessage) return null;
    const messages = useChatRoomRuntimeStore.getState().messages;
    const msg = messages.find(m => m.id === selectedMessage.id);
    return msg?.name || '나';
  }, [selectedMessage]);

  const handlePressTag = useCallback(
    (item: TagListType) => {
      if (otherUserTagIdSet.has(Number(item.tagId))) return;

      if (selectedTags.length >= 3) {
        if (selectedTags.some(t => Number(t.tagId) === Number(item.tagId))) {
          toggleTag(item);
          return;
        }
        showSnackbar({ message: '태그는 최대 3개까지 선택할 수 있습니다.', state: 'warning' });
        return;
      }
      toggleTag(item);
    },
    [otherUserTagIdSet, selectedTags, toggleTag, showSnackbar],
  );

  const handleClose = useCallback(() => {
    resetSelectedTags();
    closeTagPanel();
  }, [resetSelectedTags, closeTagPanel]);

  if (isLoading) {
    return (
      <div className="border-t border-outline bg-surface-pressed px-4 py-3">
        <span className="text-sub-sm text-text-tertiary">태그 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="border-t border-outline bg-surface-pressed px-4 py-3">
      {/* 헤더: 닫기 / 태그 / 선택 */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={handleClose} className="text-text-primary">
          <IconCloseFilled size={20} />
        </button>
        <span className="text-heading-md font-bold">태그</span>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-primary px-3 py-1 text-sub-sm text-white"
        >
          선택
        </button>
      </div>

      {/* UPDATE 모드: 메시지 미리보기 */}
      {previewText && (
        <div className="mt-2 flex items-center rounded-lg bg-white px-3 py-2">
          <div className="mr-2 h-8 w-0.5 rounded-full bg-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sub-sm text-text-secondary">{previewSender}</p>
            <p className="truncate text-sub text-text-primary">{previewText}</p>
          </div>
        </div>
      )}

      {/* 카테고리 탭 */}
      <div className="mt-3 flex">
        {categories?.map(cat => {
          const isActive = activeCategoryId === cat.categoryId;
          return (
            <button
              key={cat.categoryId}
              type="button"
              onClick={() => setSelectedCategoryId(cat.categoryId)}
              className={cn(
                'flex-1 border-b-2 py-2 text-center text-sub font-semibold transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-text-placeholder text-text-placeholder',
              )}
            >
              {cat.categoryTitle || '카테고리'}
            </button>
          );
        })}
      </div>

      {/* 태그 목록 */}
      <div className="mt-3 h-[100px] overflow-y-auto">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {filteredTags.length === 0 && (
            <span className="text-sub-sm text-text-tertiary">태그가 없습니다.</span>
          )}
          {filteredTags.map(item => {
            const selected = selectedIdSet.has(Number(item.tagId));
            const isOtherUser = otherUserTagIdSet.has(Number(item.tagId));
            return (
              <TagChip
                key={item.tagId}
                label={item.title}
                icon={isOtherUser ? undefined : selected ? 'close' : 'check'}
                selected={selected}
                disabled={isOtherUser}
                size="large"
                onClick={() => handlePressTag(item)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const TagSelectPanel = memo(TagSelectPanelComponent);
