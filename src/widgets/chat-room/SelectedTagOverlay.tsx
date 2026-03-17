'use client';

import { useMemo } from 'react';
import { clsx } from 'clsx';
import { TagChip } from '@/shared/ui/TagChip';
import { useAuthStore } from '@/store/auth/authStore';
import { useSelectedTagStore, useTagStore } from '@/store/tag/tagStore';

export function SelectedTagOverlay() {
  const { selectedTags, toggleTag } = useSelectedTagStore();
  const loginUserId = useAuthStore(s => s.user?.id);
  const tagActionType = useTagStore(s => s.tagActionType);

  const otherUserTagIdSet = useMemo(() => {
    if (tagActionType !== 'UPDATE' || !loginUserId) return new Set<number>();
    return new Set(
      selectedTags
        .filter(tag => tag.userId && String(tag.userId) !== String(loginUserId))
        .map(tag => Number(tag.tagId)),
    );
  }, [tagActionType, loginUserId, selectedTags]);

  if (!selectedTags.length) return null;

  return (
    <div className={clsx(
      'absolute bottom-0 left-0 right-0 z-10 flex flex-wrap items-center justify-center gap-2 bg-black/40 px-4 py-2',
    )}>
      {selectedTags.map(item => {
        const isOtherUser = otherUserTagIdSet.has(Number(item.tagId));
        return (
          <TagChip
            key={item.taggingId ?? item.tagId}
            label={item.title}
            size="large"
            icon={isOtherUser ? undefined : 'close'}
            selected
            disabled={isOtherUser}
            onClick={isOtherUser ? undefined : () => toggleTag(item)}
          />
        );
      })}
    </div>
  );
}
