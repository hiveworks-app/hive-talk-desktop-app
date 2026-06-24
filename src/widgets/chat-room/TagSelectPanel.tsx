'use client';

import { memo, useCallback, useMemo } from 'react';
import { useGetTagInfo } from '@/features/tag/queries';
import type { TagListType } from '@/shared/types/tag';
import { WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { IconCloseFilled } from '@/shared/ui/icons';
import { TagIcon } from '@/shared/ui/TagIcon';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useSelectedTagStore, useTagStore } from '@/store/tag/tagStore';
import { useUIStore } from '@/store/uiStore';

/** 최대 선택 가능 태그 수 (domain-feature/chat-room.md) */
const MAX_SELECTED_TAGS = 3;

interface TagSelectPanelProps {
  onConfirm?: () => void;
}

/**
 * 업무태그 선택 바텀시트 (채팅 컬럼 오버레이).
 *
 * 데스크톱은 멀티컬럼이라 RN 의 전체화면 바텀시트 대신 "채팅 컬럼 한정" 으로
 * 띄운다 — 딤은 채팅 본문(메시지+입력창)만 덮고, 헤더/사이드패널/네비는 가린다.
 * 시트는 컬럼 하단에서 슬라이드업 (Figma: 1154:16978/16979).
 *
 * 카테고리 구분 없이 전체 업무태그(20개)를 5열 그리드로 평면 노출한다
 * (정책상 바텀시트 = 전체 업무태그 목록). 최근 사용 태그 섹션은 사용기록
 * 저장소가 별도로 필요해 후속 작업으로 분리.
 */
function TagSelectPanelComponent({ onConfirm }: TagSelectPanelProps) {
  const { tagList: tags, isLoading } = useGetTagInfo();
  const { tagActionType, selectedMessage, closeTagPanel } = useTagStore();
  const { selectedTags, toggleTag, resetSelectedTags } = useSelectedTagStore();
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const loginUserId = useAuthStore(s => s.user?.id);

  // 선택된 태그 ID Set
  const selectedIdSet = useMemo(
    () => new Set(selectedTags.map(t => Number(t.tagId))),
    [selectedTags],
  );

  // UPDATE 모드: 다른 사용자가 단 태그는 해제 불가 (disabled)
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

      const alreadySelected = selectedTags.some(t => Number(t.tagId) === Number(item.tagId));
      if (!alreadySelected && selectedTags.length >= MAX_SELECTED_TAGS) {
        showSnackbar({ message: '태그는 최대 3개까지 선택 가능해요.', state: 'warning' });
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

  return (
    // 딤: 채팅 본문(메시지+입력창)만 덮음. 딤 클릭 시 선택 폐기 후 닫기.
    <div
      className="animate-tag-dim-in absolute inset-0 z-30 flex flex-col justify-end bg-black/30"
      onClick={handleClose}
    >
      {/* 시트: 하단에서 슬라이드업 */}
      <div
        className="animate-tag-sheet-up max-h-full w-full overflow-y-auto rounded-t-[20px] bg-white px-4 pb-6 pt-2.5 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] dark:bg-surface"
        onClick={e => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-outline" />

        {/* 헤더: 닫기 / 타이틀 / 완료 */}
        <div className="flex items-center gap-2 py-1">
          <button
            type="button"
            onClick={handleClose}
            aria-label="닫기"
            className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-gray-100 text-text-primary transition-colors hover:bg-outline"
          >
            <IconCloseFilled size={16} />
          </button>
          <p className="flex-1 text-center text-[16px] tracking-[-0.16px] text-text-primary">
            <span className="font-semibold">업무태그 </span>
            <span className="font-normal">(최대 3개)</span>
          </p>
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-8 shrink-0 items-center justify-center rounded-xl bg-primary px-2.5 text-[16px] font-medium text-white transition-colors hover:bg-state-primary-pressed"
          >
            완료
          </button>
        </div>

        {/* UPDATE 모드: 수정 중인 메시지 미리보기 */}
        {previewText && (
          <div className="mt-2 flex items-center rounded-lg bg-gray-100 px-3 py-2 dark:bg-surface-pressed">
            <div className="mr-2 h-8 w-0.5 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sub-sm text-text-secondary">{previewSender}</p>
              <p className="truncate text-sub text-text-primary">{previewText}</p>
            </div>
          </div>
        )}

        {/* 업무태그 그리드 (5열) */}
        <div className="mx-auto mt-4 w-full max-w-[360px]">
          {isLoading ? (
            <div className="flex h-[200px] items-center justify-center">
              <span className="text-sub-sm text-text-tertiary">태그 불러오는 중...</span>
            </div>
          ) : !tags?.length ? (
            <div className="flex h-[200px] items-center justify-center">
              <span className="text-sub-sm text-text-tertiary">태그가 없습니다.</span>
            </div>
          ) : (
            <div className="grid grid-cols-5 justify-items-center gap-x-2 gap-y-3.5">
              {tags.map(item => (
                <TagIcon
                  key={item.tagId}
                  name={item.title}
                  selected={selectedIdSet.has(Number(item.tagId))}
                  disabled={otherUserTagIdSet.has(Number(item.tagId))}
                  onClick={() => handlePressTag(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const TagSelectPanel = memo(TagSelectPanelComponent);
