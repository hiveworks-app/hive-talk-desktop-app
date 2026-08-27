'use client';

import { useEffect, useMemo, useState } from 'react';
import { closeIfPopup } from '@/shared/utils/popupWindow';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { getSidePanelBeforeAttachmentQuery, getSidePanelParticipantsQuery } from '@/features/chat-room-side-panel/queries';
import { useChangeRoomTitle } from '@/features/chat-room/useChangeRoomTitle';
import { ROOM_PARTICIPANTS_KEY } from '@/shared/config/queryKeys';
import { cn } from '@/shared/lib/cn';
import { GroupProfileAvatar, type GroupAvatarUser } from '@/shared/ui/GroupProfileAvatar';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { PresignedImage } from '@/shared/ui/PresignedImage';
import { WS_CHANNEL_TYPE, WebSocketChannelTypes } from '@/shared/types/websocket';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import { IconChevronLeft, IconChevronRight, IconAdd, IconLogout } from '@/shared/ui/icons';
import { IconUploadImage, IconFileDefault } from '@assets/icons';
import { MediaViewer } from '@/shared/ui/MediaViewer';
import { useSidePanelMediaViewer } from './useSidePanelMediaViewer';
import { useAppWebSocket } from '@/shared/websocket/WebSocketContext';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { isOffline } from '@/shared/utils/offlineGuard';
import { canEditRoomTitle, canInviteInExternalRoom } from '@/shared/utils/permissions';
import { useAuthStore } from '@/store/auth/authStore';
import { isBlockedUser, useBlockedMembersStore } from '@/store/blockedMembersStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useUIStore } from '@/store/uiStore';
import IconBlock from '@assets/icons/block.svg';
import IconExternalSymbol from '@assets/icons/external-symbol.svg';
import IconNonMember from '@assets/icons/non-member.svg';
import { buildFallbackMember } from '@/features/members/fallbackMember';
import { useGetMembers } from '@/features/members/queries';
import { MEMBERS_KEY } from '@/shared/config/queryKeys';
import type { MemberItem } from '@/shared/types/user';
import { formatMediaDuration } from '@/shared/utils/formatTimeUtils';
import { MyProfileDialog } from '@/widgets/profile/MyProfileDialog';
import { UserProfileDialog } from '@/widgets/profile/UserProfileDialog';
import { MediaTab } from './MediaTab';
import { FilesTab } from './FilesTab';
import { InviteMemberDialog } from './InviteMemberDialog';
import { CreateRoomDialog } from '@/widgets/create-room/CreateRoomDialog';
import { pendingReadRegistry } from '@/features/chat-room/pendingReadRegistry';
import { LEAVE_CONFIRM_DESCRIPTION } from '@/shared/config/constants';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useDraftStore } from '@/store/chat/draftStore';
import { useFailedMessagesStore } from '@/store/chat/failedMessagesStore';

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
  // 차단 목록 변경 시 참여자 차단 표기 즉시 반영 (구독 목적 — 값 미사용)
  useBlockedMembersStore(s => s.items);
  const { send } = useAppWebSocket();
  const { buildExitMessageRoom, buildInviteMessage } = useWebSocketMessageBuilder({
    type: channelType,
    channelId: roomId,
  });
  const currentUserId = useAuthStore(s => s.user?.id);
  const queryClient = useQueryClient();
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  // DM 대화초대 — RN 패리티: 기존 방 초대가 아니라 상대 포함 신규 GM 생성 플로우
  const [isCreateGmOpen, setIsCreateGmOpen] = useState(false);
  // 참여자 프로필 다이얼로그 — 멤버목록 미발견 시 미등록(unregistered) 처리 (RN 패리티)
  const [profileTarget, setProfileTarget] = useState<{ member: MemberItem; unregistered: boolean } | null>(null);
  // 본인 행 클릭 → 내 프로필 (RN 패리티 — 무동작 대신 내 프로필 열기)
  const [isMyProfileOpen, setIsMyProfileOpen] = useState(false);
  const openParticipantProfile = (participant: { userId: string; name: string; thumbnailProfileUrl: string | null }) => {
    if (String(participant.userId) === String(currentUserId)) {
      setIsMyProfileOpen(true);
      return;
    }
    const members = queryClient.getQueryData<MemberItem[]>(MEMBERS_KEY) ?? [];
    const found = members.find(m => String(m.userId) === String(participant.userId));
    setProfileTarget(
      found
        ? { member: found, unregistered: false }
        : {
            member: buildFallbackMember({
              userId: String(participant.userId),
              name: participant.name,
              thumbnailProfileUrl: participant.thumbnailProfileUrl,
              isExternal: channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE,
            }),
            unregistered: true,
          },
    );
  };

  const roomName = useChatRoomInfo(s => s.roomName);
  const totalUserCount = useChatRoomInfo(s => s.totalUserCount);
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
    // lastMessageId 게이팅 제거 — 해당 인자는 legacy 무시 파라미터라, 메시지 로드 전 패널을
    // 열면 미리보기만 비어 보였다 (2026-08-26 감사, 파일 탭과 동일 조건으로)
    ...getSidePanelBeforeAttachmentQuery(roomId, lastMessageId, channelType),
    enabled: isOpen && !!roomId,
  });
  const previewAll = attachmentData?.pages.flatMap(p => p.items) ?? [];
  const previewMedia = previewAll.slice(0, 4); // RN 패리티 — 패널 폭 기준 한 줄(4개)만
  // 미리보기 썸네일 클릭 → 그 사진부터 뷰어 (RN onPressPicture 패리티 — 보관함 목록이 아니라 뷰어)
  const previewViewer = useSidePanelMediaViewer(previewAll);

  // 멤버목록 병합용 — 서버 /participants의 isExternal·부서·직급 누락을 멤버 캐시로 보강 (RN 패리티)
  const { data: membersData } = useGetMembers();
  const viewerCompanyId = useAuthStore(s => s.user?.companyId);
  const sortedParticipants = useMemo(() => {
    const memberByUserId = new Map((membersData ?? []).map(m => [String(m.userId), m]));
    return participants
      .map(participant => {
        const member = memberByUserId.get(String(participant.userId));
        // 같은 회사 판정 — companyId가 한쪽이라도 null이면 매칭 false (RN 패리티)
        const isSameCompany =
          participant.companyId != null &&
          viewerCompanyId != null &&
          String(participant.companyId) === String(viewerCompanyId);
        // 외부 미등록 = 멤버목록에 없고 같은 회사도 아님. 서버 isExternal이 비멤버에
        // false로 내려오는 한계를 보강해 별도 표시(IconNonMember)용 derived 플래그.
        const isUnregisteredExternal = !member && !isSameCompany;
        if (!member) return { ...participant, isUnregisteredExternal };
        return {
          ...participant,
          department: participant.department || member.department || null,
          job: participant.job || member.job || null,
          // 서버가 외부 멤버에 isExternal: false를 반환하는 케이스 존재 (백엔드 정합성 이슈) — 둘 중 하나라도 true면 외부
          isExternal: Boolean(participant.isExternal || member.isExternal),
          isUnregisteredExternal,
        };
      })
      .sort((a, b) => {
        if (String(a.userId) === String(currentUserId)) return -1;
        if (String(b.userId) === String(currentUserId)) return 1;
        return 0;
      });
  }, [participants, membersData, viewerCompanyId, currentUserId]);

  const [isExitConfirmOpen, setExitConfirmOpen] = useState(false);
  const handleExitRoom = () => {
    if (!roomId) return;
    if (isOffline()) return;
    setExitConfirmOpen(true);
  };
  const confirmExitRoom = () => {
    setExitConfirmOpen(false);
    send(buildExitMessageRoom({ channelIdOverride: roomId }));
    // 나간 방의 드래프트·실패 메시지·보류 READ 정리 (RN 패리티)
    useDraftStore.getState().clearDraft(roomId);
    useFailedMessagesStore.getState().removeRoom(roomId);
    pendingReadRegistry.removeRoom(roomId);
    // 팝업(멀티 채팅창)은 돌아갈 목록이 없다 — 목록으로 라우팅하면 팝업이 앱 전체 창으로 바뀐다
    if (closeIfPopup()) return;
    const routePrefix = channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE ? '/external-chat' : '/chat';
    router.push(routePrefix);
    onClose();
    // 목록 개별 나가기와 동일한 완료 안내 (내부 일관성)
    showSnackbar({ message: '채팅방을 나갔어요.', state: 'success' });
  };

  const handleInvite = (userIds: string[]) => {
    if (!roomId || userIds.length === 0) return;
    if (isOffline()) return;
    send(buildInviteMessage({ inviteUserIdArray: userIds, channelIdOverride: roomId }));
    showSnackbar({ message: `${userIds.length}명을 초대했어요.`, state: 'success' });
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
    <div className="flex h-full w-full flex-col rounded-l-2xl border-l border-divider bg-background">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-divider px-4 py-3">
        <div className="flex items-center gap-2">
          {view !== 'main' && (
            <button
              onClick={handleBack}
              className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition-opacity hover:opacity-70 active:opacity-60"
            >
              <IconChevronLeft size={20} />
            </button>
          )}
          {/* 채팅방 헤더 타이틀(text-heading-md medium)과 동일 스타일 (사용자 결정 2026-08-25).
              메인 뷰 타이틀은 방 이름 + 인원수 (RN ChatRoomSidePanelScreen 패리티) */}
          <h3 className="min-w-0 truncate text-heading-md font-medium text-text-primary">
            {view === 'main' ? (
              <>
                {roomName || '채팅방 정보'}
                {totalUserCount > 0 && <span className="ml-1 text-gray-400">{totalUserCount}</span>}
              </>
            ) : view === 'media' ? '사진/동영상' : '파일'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
        >
          <IconCloseStroke width={14} height={14} />
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {view === 'main' ? (
          <div className="flex flex-col">
            {/* 상단 프로필 섹션 — DM 단일 대형 / GM·EM 조합 아바타 + 대화초대 (RN SidePanel*Profile 패리티) */}
            {(() => {
              const others = sortedParticipants.filter(p => String(p.userId) !== String(currentUserId));
              const isAloneRoom = participants.length > 0 && others.length === 0;
              const avatarUsers: GroupAvatarUser[] = others
                .slice(0, 4)
                .map(p => ({ name: p.name, storageKey: p.thumbnailProfileUrl }));
              // 참여자 미반영(신규 EM 직후 등)이라도 초대 가능하면 섹션 유지 — 초대 버튼 소실 방지 (RN 패리티)
              if (others.length === 0 && !isAloneRoom && !canInvite) return null;
              return (
                <div className="flex flex-col items-center gap-2.5 border-b border-divider py-5">
                  {/* RN 사이드패널 패리티 — 상단 대형 프로필 90px. DM은 원본 우선(90px 업스케일 흐림 방지) */}
                  {channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE && others[0] ? (
                    <ProfileCircle name={others[0].name} size="lg" storageKey={others[0].profileUrl ?? others[0].thumbnailProfileUrl} className="h-[90px] w-[90px]" />
                  ) : (others.length > 0 || isAloneRoom) ? (
                    <div className={cn('relative', isAloneRoom && 'opacity-50')}>
                      <GroupProfileAvatar users={avatarUsers} size="lg" />
                    </div>
                  ) : null}
                  {canInvite && (
                    <button
                      onClick={() => (channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE ? setIsCreateGmOpen(true) : setIsInviteOpen(true))}
                      className="flex items-center gap-1 rounded-md border border-primary bg-white px-3.5 py-2 text-sub font-medium text-primary transition-colors hover:bg-[#E6F3FF]"
                    >
                      <IconAdd size={16} />
                      대화초대
                    </button>
                  )}
                </div>
              );
            })()}

            {/* 채팅방 이름 (GM/EM 전용 — DM은 제목=상대방 이름이라 수정 불가) */}
            {channelType !== WS_CHANNEL_TYPE.DIRECT_MESSAGE && (
              <div className="border-b border-divider px-4 py-3">
                {isEditingTitle ? (
                  <>
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
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
                        className="w-full rounded-md border border-divider bg-gray-50 px-2.5 py-1.5 pr-12 text-sub text-text-primary outline-none transition focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary"
                      />
                      {/* RN 패리티 — {n}/50 글자수 카운터 */}
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sub-sm text-text-tertiary">
                        {titleDraft.length}/50
                      </span>
                    </div>
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
                  {/* RN ChatRoomSettingsScreen 안내 문구 패리티 */}
                  <p className="mt-1.5 text-sub-sm text-text-tertiary">
                    채팅방 이름을 변경하면, 모두에게 같은 이름으로 변경돼요.
                  </p>
                  </>
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

            {/* 보관함 섹션 라벨 (RN SidePanelTopMenu 패리티) */}
            <div className="px-4 pb-1 pt-4">
              <span className="text-sub text-gray-600">보관함</span>
            </div>

            {/* 사진/동영상 섹션 */}
            <button
              onClick={() => setView('media')}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                {/* RN SidePanelTopMenu 패리티 — 32px gray-100 박스 + 컬러 아이콘 (입력 툴바와 동일 색) */}
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100">
                  <IconUploadImage width={20} height={20} className="text-state-success" />
                </span>
                <span className="text-body font-medium text-text-primary">사진/동영상</span>
              </div>
              <IconChevronRight size={16} className="text-text-tertiary" />
            </button>
            {previewMedia.length > 0 && (
              <div className="grid grid-cols-4 gap-2 px-4 pb-3">
                {previewMedia.map((media, idx) => {
                  const isBlocked = !!media.senderId && isBlockedUser(String(media.senderId));
                  return (
                    <button
                      key={media.id}
                      onClick={() => previewViewer.open(idx)}
                      className="relative aspect-square overflow-hidden rounded bg-gray-100"
                    >
                      <PresignedImage
                        storageKey={media.thumbnailPath || media.path}
                        fallbackUrl={media.thumbnailPresignedUrl || media.presignedUrl}
                        className="h-full w-full object-cover"
                      />
                      {/* 동영상 길이 배지 (RN SidePanelMediaThumb 패리티 — 보관함 탭과 동일 규칙) */}
                      {media.messageContentType === 'MEDIA' && formatMediaDuration(media.duration) && (
                        <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                          {formatMediaDuration(media.duration)}
                        </span>
                      )}
                      {/* 차단 발신자 리소스 가림 (RN Figma 3145:66586) */}
                      {isBlocked && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70">
                          <IconBlock width={18} height={18} className="text-gray-500" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 파일 섹션 */}
            <button
              onClick={() => setView('files')}
              className="flex items-center justify-between border-b border-divider px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100">
                  <IconFileDefault width={20} height={20} className="text-state-error" />
                </span>
                <span className="text-body font-medium text-text-primary">파일</span>
              </div>
              <IconChevronRight size={16} className="text-text-tertiary" />
            </button>

            {/* 대화상대 섹션 — 인원수 병기 (RN "대화상대 (N)" 패리티) */}
            <div className="px-4 pb-2 pt-4">
              <span className="text-sub text-gray-600">대화상대 ({sortedParticipants.length})</span>
            </div>

            {/* 대화상대 초대는 상단 프로필 섹션의 [대화초대] pill 하나만 — 하단 행은 RN도 전 채널 숨김 (진입점 중복 제거) */}

            {/* 참여자 목록 */}
            {sortedParticipants.map(p => {
              const isMe = String(p.userId) === String(currentUserId);
              // 서버 /participants 응답 대신 로컬 차단 스토어로 판정 (참여자 쿼리 stale 대비, RN 패리티)
              const isBlocked = !isMe && isBlockedUser(String(p.userId));
              return (
                <button
                  key={p.userId}
                  type="button"
                  onClick={() => openParticipantProfile(p)}
                  className="flex w-full items-center gap-3 px-4 py-1.5 text-left transition-colors hover:bg-gray-100"
                >
                  <div className="relative shrink-0">
                    <ProfileCircle
                      name={p.name}
                      size="sm"
                      storageKey={p.thumbnailProfileUrl}
                    />
                    {isBlocked && (
                      <div className="pointer-events-none absolute inset-0 rounded-full bg-white/40" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    {isMe && (
                      // RN 패리티 — brand-primary-300(노랑) 배지 + gray-900 텍스트
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFED66] text-[11px] font-semibold text-gray-900">
                        나
                      </span>
                    )}
                    <span className={cn('truncate text-body', isMe ? 'font-semibold text-text-primary' : isBlocked ? 'text-gray-500' : 'text-text-primary')}>
                      {p.name}
                    </span>
                    {/* 차단 아이콘은 이름 뒤 (RN SidePanelParticipantItem 패리티) */}
                    {isBlocked && <IconBlock width={16} height={16} className="shrink-0 text-gray-500" />}
                    {/* 본인 프로필엔 외부/미등록 표시 불필요 (RN 패리티) */}
                    {!isMe && p.isExternal ? (
                      <IconExternalSymbol width={18} height={10} className="shrink-0 text-gray-400" />
                    ) : !isMe && p.isUnregisteredExternal ? (
                      <IconNonMember width={18} height={18} className="shrink-0 text-gray-400" />
                    ) : null}
                    {(() => {
                      // EM — 사내/외부 무관 "회사명·직급" / DM·GM — "부서·직급" (RN 패리티)
                      const isEM = channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE;
                      const rightText = isEM
                        ? [p.companyName, p.job].filter(Boolean).join('·')
                        : [p.department, p.job].filter(Boolean).join('·');
                      if (!rightText) return null;
                      return (
                        <span className="ml-auto shrink-0 truncate pl-2 text-right text-sub-sm text-gray-600">
                          {rightText}
                        </span>
                      );
                    })()}
                  </div>
                </button>
              );
            })}

            {/* 채팅방 나가기 — 참여자 목록과의 구분선 포함 (RN 보관함+대화상대 섹션 border-b 패리티) */}
            <div className="mt-3 border-t border-divider px-4 py-6">
              {/* RN SidePanelBottomMenu 패리티 — 솔리드 레드 버튼 */}
              <button
                onClick={handleExitRoom}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-state-error px-4 py-2.5 text-body font-medium text-white transition-colors hover:bg-state-error-pressed active:bg-state-error-pressed"
              >
                <IconLogout size={18} className="text-white" />
                채팅방 나가기
              </button>
            </div>
          </div>
        ) : (
          // 보관함: 상단 pill로 사진/동영상 ↔ 파일 즉시 전환 (RN SidePanelSelectItemTitle 패리티).
          // 두 탭을 언마운트하지 않고 hidden 전환 — 각 탭의 검색어·선택 상태가 유지된다 (RN 유지 정책)
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-1.5 px-4 pb-1 pt-2">
              {([['media', '사진/동영상'], ['files', '파일']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sub font-medium transition-colors',
                    view === key
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={view === 'media' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
              <MediaTab roomId={roomId} channelType={channelType} lastMessageId={lastMessageId} />
            </div>
            <div className={view === 'files' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
              <FilesTab roomId={roomId} channelType={channelType} lastMessageId={lastMessageId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 오버레이 배경 (fade) — 창 폭 무관 단일 모드 (사용자 결정 2026-08-25). 이전의 768px 이중
          모드(미만 오버레이/이상 인라인)는 닫힌 채 창 폭이 경계를 넘나들 때 두 모드의 translate·width
          차이가 transition에 걸려 패널이 화면을 지나가는 애니메이션이 재생되는 문제가 있었다. */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/30 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      {/* 패널 — 오른쪽 슬라이드 오버레이. 기본 창 폭(480px)에서 인라인 320px는 대화 영역이
          남지 않으므로 오버레이가 모든 폭에서 성립하는 유일한 방식이다. */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-40 w-[320px] transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full',
        )}
      >
        {panelContent}
      </div>

      {/* DM 대화초대 → 상대 포함 신규 GM 생성 (RN CreateChatRoomScreen 진입 대응).
          조건부 마운트 필수 — 상시 마운트하면 preset이 참여자 로드 전(빈 배열)의 lazy useState로
          굳어 기존 상대가 빠진 방이 생성된다 (2026-08-26 감사 실측) */}
      {isCreateGmOpen && (
        <CreateRoomDialog
          isOpen
          onClose={() => setIsCreateGmOpen(false)}
          presetMemberIds={participants
            .filter(p => String(p.userId) !== String(currentUserId))
            .map(p => String(p.userId))}
        />
      )}

      {/* 메인 뷰 미리보기 썸네일 → 전체화면 뷰어 (보관함 탭 뷰어와 동일 컴포넌트) */}
      <MediaViewer
        visible={previewViewer.visible}
        items={previewViewer.items}
        currentIndex={previewViewer.index}
        onIndexChange={previewViewer.setIndex}
        onClose={previewViewer.close}
      />

      <InviteMemberDialog
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        existingUserIds={participants.map(p => String(p.userId))}
        onInvite={handleInvite}
        companyOnly={channelType !== WS_CHANNEL_TYPE.EXTERNAL_MESSAGE}
      />

      {/* 채팅방 나가기 확인 — 방 이름·인원수 + 재초대 안내 (RN showConfirm 패리티) */}
      <ConfirmDialog
        open={isExitConfirmOpen}
        title={roomName || '채팅방'}
        titleSuffix={
          channelType !== WS_CHANNEL_TYPE.DIRECT_MESSAGE && sortedParticipants.length
            ? String(sortedParticipants.length)
            : undefined
        }
        description={
          channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE
            ? LEAVE_CONFIRM_DESCRIPTION.SIMPLE
            : LEAVE_CONFIRM_DESCRIPTION.GROUP
        }
        confirmLabel="나가기"
        cancelLabel="취소"
        destructive
        onConfirm={confirmExitRoom}
        onCancel={() => setExitConfirmOpen(false)}
      />

      {/* 참여자 프로필 (DM에서는 [1:1 채팅] 비활성 — 이미 그 방) */}
      <UserProfileDialog
        isOpen={profileTarget !== null}
        onClose={() => setProfileTarget(null)}
        member={profileTarget?.member ?? null}
        unregistered={profileTarget?.unregistered}
        disableDirectChat={channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE}
      />

      {/* 본인 행 클릭 → 내 프로필 (RN 패리티) */}
      <MyProfileDialog isOpen={isMyProfileOpen} onClose={() => setIsMyProfileOpen(false)} />
    </>
  );
}
