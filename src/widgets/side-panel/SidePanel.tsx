'use client';

import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { getSidePanelBeforeAttachmentQuery, getSidePanelParticipantsQuery } from '@/features/chat-room-side-panel/queries';
import { cn } from '@/shared/lib/cn';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';
import { IconChevronLeft, IconChevronRight, IconClose, IconImage, IconDescription, IconAdd, IconLogout } from '@/shared/ui/icons';
import { useAppWebSocket } from '@/shared/websocket/WebSocketContext';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { isOffline } from '@/shared/utils/offlineGuard';
import { useAuthStore } from '@/store/auth/authStore';
import { MediaTab } from './MediaTab';
import { FilesTab } from './FilesTab';

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
  const { buildExitMessageRoom } = useWebSocketMessageBuilder({
    type: channelType,
    channelId: roomId,
  });
  const currentUserId = useAuthStore(s => s.user?.id);

  // 패널 닫힐 때 메인 뷰로 복귀
  useEffect(() => {
    if (!isOpen) setView('main');
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

  const handleBack = () => setView('main');

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

            {/* 대화상대 초대 */}
            <div className="px-4 py-1.5">
              <button className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                  <IconAdd size={18} className="text-primary" />
                </div>
                <span className="text-sub font-medium text-primary">대화상대 초대</span>
              </button>
            </div>

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
    </>
  );
}
