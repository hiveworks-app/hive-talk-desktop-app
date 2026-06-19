'use client';

import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { getSidePanelBeforeAttachmentQuery, getSidePanelParticipantsQuery } from '@/features/chat-room-side-panel/queries';
import { useChangeRoomTitle } from '@/features/chat-room/useChangeRoomTitle';
import { ROOM_PARTICIPANTS_KEY } from '@/shared/config/queryKeys';
import { cn } from '@/shared/lib/cn';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';
import { IconChevronLeft, IconChevronRight, IconClose, IconImage, IconDescription, IconAdd, IconLogout } from '@/shared/ui/icons';
import { useAppWebSocket } from '@/shared/websocket/WebSocketContext';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { isOffline } from '@/shared/utils/offlineGuard';
import { canEditRoomTitle, canInviteInExternalRoom } from '@/shared/utils/permissions';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useUIStore } from '@/store/uiStore';
import { MediaTab } from './MediaTab';
import { FilesTab } from './FilesTab';
import { InviteMemberDialog } from './InviteMemberDialog';

type SidePanelView = 'main' | 'media' | 'files';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  channelType: WebSocketChannelTypes;
  lastMessageId: string;
}

export function SidePanel({ isOpen, onClose, roomId, channelType, lastMessageId }: SidePanelProps) {
  const [view, setView] = useState<SidePanelView>('main');
  const router = useAppRouter();
  const { send } = useAppWebSocket();
  const { buildExitMessageRoom, buildInviteMessage } = useWebSocketMessageBuilder({
    type: channelType,
    channelId: roomId,
  });
  const currentUserId = useAuthStore(s => s.user?.id);
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const roomName = useChatRoomInfo(s => s.roomName);
  const userRole = useAuthStore(s => s.user?.role);
  const { mutate: changeRoomTitle, isPending: isTitleSaving } = useChangeRoomTitle();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  // 권한 (RN 패리티): 제목 수정 = DM 제외 + GUEST 제외 / EM 초대 = GUEST 제외 (DM·GM은 항상 초대 가능)
  const canEditTitle =
    channelType !== WS_CHANNEL_TYPE.DIRECT_MESSAGE && !!userRole && canEditRoomTitle(userRole);
  const canInvite =
    channelType !== WS_CHANNEL_TYPE.EXTERNAL_MESSAGE ||
    (!!userRole && canInviteInExternalRoom(userRole));

  // 패널 닫힐 때 메인 뷰로 복귀 (open 상태에 내부 view 동기화 — 의도된 effect)
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView('main');
      setIsEditingTitle(false);
    }
  }, [isOpen]);

  const { data: participants = [] } = useQuery({
    ...getSidePanelParticipantsQuery(roomId, channelType),
    enabled: isOpen && !!roomId,
  });

  const { data: attachmentData } = useInfiniteQuery({
    ...getSidePanelBeforeAttachmentQuery(roomId, lastMessageId, channelType),
    enabled: isOpen && !!roomId && !!lastMessageId,
  });
  const previewMedia = attachmentData?.pages.flat().slice(0, 5) ?? [];

  const sortedParticipants = [...participants].sort((a, b) => {
    if (String(a.userId) === String(currentUserId)) return -1;
    if (String(b.userId) === String(currentUserId)) return 1;
    return 0;
  });

  const handleExitRoom = () => {
    if (!roomId) return;
    if (isOffline()) return;
    if (!window.confirm('채팅방을 나가시겠습니까?')) return;
    send(buildExitMessageRoom({ channelIdOverride: roomId }));
    const routePrefix = channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE ? '/external-chat' : '/chat';
    router.push(routePrefix);
    onClose();
  };

  const handleInvite = (userIds: string[]) => {
    if (!roomId || userIds.length === 0) return;
    if (isOffline()) return;
    send(buildInviteMessage({ inviteUserIdArray: userIds, channelIdOverride: roomId }));
    showSnackbar({ message: `${userIds.length}명을 초대했습니다.`, state: 'success' });
    setIsInviteOpen(false);
    // SUBMIT_INVITE 브로드캐스트가 늦을 수 있어 참여자 목록 명시 무효화
    queryClient.invalidateQueries({ queryKey: ROOM_PARTICIPANTS_KEY(roomId, channelType) });
  };

  const handleBack = () => setView('main');

  const handleTitleEditStart = () => {
    setTitleDraft(roomName ?? '');
    setIsEditingTitle(true);
  };

  /**
   * 제목 검증 규칙 — 유효하면 정규화된 제목, 아니면 null.
   * 정책: 공백 제외 1~50자 (chat.md 새 채팅방 이름 규칙과 동일). 양끝 공백 trim.
   */
  const validateRoomTitle = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > 50) return null;
    return trimmed;
  };

  const handleTitleSubmit = () => {
    const valid = validateRoomTitle(titleDraft);
    if (!valid) {
      showSnackbar({ message: '채팅방 이름은 1~50자로 입력해주세요.', state: 'error' });
      return;
    }
    if (valid === roomName) {
      setIsEditingTitle(false);
      return;
    }
    if (isOffline()) return;
    changeRoomTitle(valid, {
      onSuccess: () => {
        showSnackbar({ message: '채팅방 이름이 변경되었습니다.', state: 'success' });
        setIsEditingTitle(false);
      },
      onError: () => showSnackbar({ message: '채팅방 이름 변경에 실패했습니다.', state: 'error' }),
    });
  };

  const panelContent = (
    <div className="flex h-full w-[300px] flex-col rounded-l-2xl border-l border-divider bg-background md:w-[320px]">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-divider px-4 py-3">
        <div className="flex items-center gap-2">
          {view !== 'main' && (
            <button
              onClick={handleBack}
              className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:bg-gray-100"
            >
              <IconChevronLeft size={16} />
            </button>
          )}
          <h3 className="text-sub font-bold text-text-primary">
            {view === 'main' ? '채팅방 정보' : view === 'media' ? '사진/동영상' : '파일'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-text-tertiary hover:bg-gray-100"
        >
          <IconClose size={14} />
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {view === 'main' ? (
          <div className="flex flex-col">
            {/* 채팅방 이름 (GM/EM 전용 — DM은 제목=상대방 이름이라 수정 불가) */}
            {channelType !== WS_CHANNEL_TYPE.DIRECT_MESSAGE && (
              <div className="border-b border-divider px-4 py-3">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={titleDraft}
                      onChange={e => setTitleDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleTitleSubmit();
                        if (e.key === 'Escape') setIsEditingTitle(false);
                      }}
                      maxLength={50}
                      placeholder="채팅방 이름"
                      className="min-w-0 flex-1 rounded-md border border-divider bg-gray-50 px-2.5 py-1.5 text-sub text-text-primary outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleTitleSubmit}
                      disabled={isTitleSaving}
                      className="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-sub-sm font-medium text-on-primary disabled:opacity-50"
                    >
                      확인
                    </button>
                    <button
                      onClick={() => setIsEditingTitle(false)}
                      className="shrink-0 rounded-md px-2 py-1.5 text-sub-sm text-text-tertiary hover:bg-gray-100"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sub-sm text-text-tertiary">채팅방 이름</p>
                      <p className="truncate text-sub font-medium text-text-primary">{roomName || '채팅방'}</p>
                    </div>
                    {canEditTitle && (
                      <button
                        onClick={handleTitleEditStart}
                        className="shrink-0 rounded-md px-2 py-1 text-sub-sm font-medium text-primary hover:bg-gray-100"
                        aria-label="채팅방 이름 수정"
                      >
                        수정
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 사진/동영상 섹션 */}
            <button
              onClick={() => setView('media')}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <IconImage size={22} className="text-text-primary" />
                <span className="text-sub font-medium text-text-primary">사진/동영상</span>
              </div>
              <IconChevronRight size={16} className="text-text-tertiary" />
            </button>
            {previewMedia.length > 0 && (
              <div className="grid grid-cols-4 gap-2 px-4 pb-3">
                {previewMedia.map(media => (
                  <button
                    key={media.id}
                    onClick={() => setView('media')}
                    className="aspect-square overflow-hidden rounded bg-gray-100"
                  >
                    <img
                      src={media.thumbnailPresignedUrl || media.presignedUrl || media.path}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* 파일 섹션 */}
            <button
              onClick={() => setView('files')}
              className="flex items-center justify-between border-b border-divider px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <IconDescription size={22} className="text-text-primary" />
                <span className="text-sub font-medium text-text-primary">파일</span>
              </div>
              <IconChevronRight size={16} className="text-text-tertiary" />
            </button>

            {/* 대화상대 섹션 */}
            <div className="px-4 pb-2 pt-4">
              <span className="text-sub font-bold text-text-primary">대화상대</span>
            </div>

            {/* 대화상대 초대 (EM은 GUEST 불가 — RN 패리티) */}
            {canInvite && (
              <div className="px-4 py-1.5">
                <button onClick={() => setIsInviteOpen(true)} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                    <IconAdd size={18} className="text-primary" />
                  </div>
                  <span className="text-sub font-medium text-primary">대화상대 초대</span>
                </button>
              </div>
            )}

            {/* 참여자 목록 */}
            {sortedParticipants.map(p => {
              const isMe = String(p.userId) === String(currentUserId);
              return (
                <div key={p.userId} className="flex items-center gap-3 px-4 py-1.5">
                  <ProfileCircle
                    name={p.name}
                    size="sm"
                    storageKey={p.thumbnailProfileUrl}
                  />
                  <div className="flex items-center gap-1.5">
                    {isMe && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                        나
                      </span>
                    )}
                    <span className={cn('text-sub', isMe ? 'font-semibold text-text-primary' : 'text-text-primary')}>
                      {p.name}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* 채팅방 나가기 */}
            <div className="px-4 py-6">
              <button
                onClick={handleExitRoom}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sub font-medium text-red-500 transition-colors hover:bg-red-100"
              >
                <IconLogout size={18} className="text-red-500" />
                채팅방 나가기
              </button>
            </div>
          </div>
        ) : view === 'media' ? (
          <MediaTab roomId={roomId} channelType={channelType} lastMessageId={lastMessageId} />
        ) : (
          <FilesTab roomId={roomId} channelType={channelType} lastMessageId={lastMessageId} />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 모바일 오버레이 배경 (fade) */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/30 transition-opacity duration-300 md:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      {/* 패널 — 모바일: slide-in, 데스크톱: width expand */}
      <div
        className={cn(
          'shrink-0',
          // 모바일: 오른쪽에서 슬라이드
          'fixed inset-y-0 right-0 z-40 w-[300px] transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full',
          // 데스크톱: width 애니메이션으로 공간 확보
          'md:relative md:inset-auto md:z-auto md:w-auto md:translate-x-0 md:overflow-hidden md:transition-[width] md:duration-300 md:ease-out',
          isOpen ? 'md:w-[320px]' : 'md:w-0',
          // 닫혔을 때 데스크톱에서 pointer-events 복원
          isOpen && 'md:pointer-events-auto',
        )}
      >
        {panelContent}
      </div>

      <InviteMemberDialog
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        existingUserIds={participants.map(p => String(p.userId))}
        onInvite={handleInvite}
      />
    </>
  );
}
