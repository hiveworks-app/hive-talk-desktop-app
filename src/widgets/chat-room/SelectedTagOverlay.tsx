'use client';

import { IconTag } from '@assets/icons';
import { TAG_ICON_MAP, type TagName } from '@/shared/ui/TagIcon';
import { useSelectedTagStore, useTagStore } from '@/store/tag/tagStore';

/**
 * 다음 메시지와 함께 나갈 업무태그 미리보기 — 입력창 위에 겹쳐 뜨는 아이콘 배지 줄.
 *
 * RN(ChatRoomBottom `selectedTagBadge`) 정본을 그대로 따른다:
 * 24×24 흰 배지(radius 8, 0.5px gray-200 테두리) + 14px 태그 아이콘, 라벨 없음, 좌측 정렬.
 *
 * 레이아웃을 밀지 않는 것이 핵심이다. RN은 `absolute` + 음수 top으로 부모 높이 측정에서 빠져
 * "메시지 리스트가 위로 밀리지 않고 배지만 입력바 위에 겹친다". 여기서는 높이 0인 relative 상자에
 * 담아 같은 결과를 만든다 — normal flow로 두면 태그를 고를 때마다 입력창이 아래로 내려앉는다.
 *
 * UPDATE(기존 메시지의 태그 수정) 중에는 표시하지 않는다 — 선택 상태는 태그 패널이 이미 보여준다
 * (RN `shouldShowSelectedTagBadges` 동일 조건).
 */
export function SelectedTagOverlay() {
  const { selectedTags, toggleTag } = useSelectedTagStore();
  const tagActionType = useTagStore(s => s.tagActionType);

  if (tagActionType === 'UPDATE' || selectedTags.length === 0) return null;

  return (
    // h-0 → 레이아웃 높이를 차지하지 않는다. 자식은 이 선 위(bottom-1)로 떠오른다.
    <div className="relative z-10 h-0">
      {/* px-3 = ChatInput 좌우 패딩 — 배지가 입력창 첫 글자에 맞춰 선다 */}
      <div className="absolute bottom-1 left-0 flex items-center gap-1 px-3">
        {selectedTags.map(item => {
          const SvgIcon = TAG_ICON_MAP[item.title as TagName];
          return (
            <button
              key={item.taggingId ?? item.tagId}
              type="button"
              onClick={() => toggleTag(item)}
              title={`${item.title} 태그 해제`}
              aria-label={`${item.title} 태그 해제`}
              // RN은 탭 불가(배지 표시 전용)지만 데스크톱은 다시 눌러 해제할 수 있게 둔다.
              // 겉모습은 RN과 동일하게 유지하고 hover는 배경 없이 디밍만.
              className="flex size-6 shrink-0 items-center justify-center rounded-lg border-[0.5px] border-gray-200 bg-white transition-opacity hover:opacity-70 active:opacity-60"
            >
              {SvgIcon ? (
                <SvgIcon width={14} height={14} />
              ) : (
                <IconTag width={14} height={14} className="text-gray-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
