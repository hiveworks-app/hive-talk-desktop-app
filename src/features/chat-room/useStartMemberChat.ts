'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { useCheckDuplicateEM } from '@/features/external-chat/queries';
import { DM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import type { MemberItem } from '@/shared/types/user';
import { WS_CHANNEL_TYPE, type WebSocketPublishItem } from '@/shared/types/websocket';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';

/** EM 방 제목 입력 대기 상태 — 대상 멤버 + 입력 중 제목 */
export interface EMTitleDraft {
  member: MemberItem;
  title: string;
}

interface UseStartMemberChatOptions {
  /** 라우팅 직전 호출 — 열려 있는 프로필 다이얼로그/커서 메뉴를 닫는 용도 */
  onBeforeNavigate?: () => void;
}

/**
 * 멤버 → 1:1 채팅 시작 (프로필 [1:1 채팅] 버튼·우클릭 메뉴·행 더블클릭 공용).
 * - 사내멤버: DM 목록 캐시에서 기존 방 탐색 → 이동, 없으면 draft(/chat/new)
 * - 협력멤버: EM 중복검사 → 기존 방 이동, 없으면 방 제목 입력(emTitleDraft) 후 draft(/external-chat/new)
 * 방 생성 API는 여기서 호출하지 않는다 — 첫 메시지 전송 시 ensureRoomId가 생성 (빈 방 잔존 방지).
 */
export function useStartMemberChat({ onBeforeNavigate }: UseStartMemberChatOptions = {}) {
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const myUserId = useAuthStore(s => s.user?.id);
  const { mutateAsync: checkDuplicateEM, isPending: isCheckingEM } = useCheckDuplicateEM();
  // 협력멤버 1:1 EM 생성 — 방 제목 입력 단계 (RN 제목 입력 화면 대응)
  const [emTitleDraft, setEmTitleDraftState] = useState<EMTitleDraft | null>(null);

  const navigateToDMRoom = (
    member: MemberItem,
    roomId: string,
    lastMessage: WebSocketPublishItem | null = null,
    invitedUserIds: string[] = [],
  ) => {
    useChatRoomInfo.getState().setChatRoomInfo({
      roomId,
      roomName: member.name,
      channelType: WS_CHANNEL_TYPE.DIRECT_MESSAGE,
      totalUserCount: 2,
      otherUserIsExit: false,
      otherUserIsRemoved: false,
      lastMessage,
      invitedUserIds,
    });
    if (!roomId) {
      useChatRoomRuntimeStore.setState({ currentRoomId: null, messages: [] });
    }
    onBeforeNavigate?.();
    router.push(roomId ? `/chat/${roomId}` : '/chat/new');
  };

  const startDM = (member: MemberItem) => {
    // 캐시에서 기존 방 확인
    const dmRooms = queryClient.getQueryData<GetChatRoomListItemType[]>(DM_ROOM_LIST_KEY) ?? [];
    const uid = String(member.userId);
    const existing = dmRooms.find(room => {
      if (String(room.roomModel.participantDetail?.userId) === uid) return true;
      return room.roomModel.participants?.some(p => String(p.userId) === uid) ?? false;
    });
    if (existing) {
      navigateToDMRoom(member, existing.roomModel.roomId, existing.messageList[0] ?? null);
      return;
    }
    // 기존 방 없음 → roomId 없이 채팅방 진입 (메시지 전송 시 생성)
    navigateToDMRoom(member, '', null, [member.userId]);
  };

  const enterEMRoom = (member: MemberItem, roomId: string, title: string) => {
    useChatRoomInfo.getState().setChatRoomInfo({
      roomId,
      roomName: title || member.name,
      channelType: WS_CHANNEL_TYPE.EXTERNAL_MESSAGE,
      totalUserCount: 2,
      otherUserIsExit: false,
      otherUserIsRemoved: false,
      lastMessage: null,
      invitedUserIds: [],
    });
    onBeforeNavigate?.();
    router.push(`/external-chat/${roomId}`);
  };

  // 협력멤버 1:1 — DM이 아닌 EM 플로우 (정책 em.md, RN C1 패리티): 중복검사 → 기존 방 이동 / 새 방 제목 입력
  const startEM = async (member: MemberItem) => {
    if (isCheckingEM) return;
    try {
      const res = await checkDuplicateEM([String(member.userId), String(myUserId)].filter(Boolean));
      const { exists, roomIds } = res.payload;
      if (exists && roomIds[0]) {
        // 기존 협력방으로 이동 — 캐시에서 제목 조회
        const cached = queryClient.getQueryData<GetChatRoomListItemType[]>(EM_ROOM_LIST_KEY) ?? [];
        const found = cached.find(r => r.roomModel.roomId === roomIds[0]);
        enterEMRoom(member, roomIds[0], found?.roomModel.title ?? member.name);
        return;
      }
    } catch {
      // 검사 실패는 생성 시 서버가 재검증 (RN §7-C-6 정책) — 제목 입력으로 진행
    }
    setEmTitleDraftState({ member, title: member.name });
  };

  /** 1:1 채팅 시작 — 사내=DM, 협력=EM. 본인 대상은 무시 */
  const startChat = (member: MemberItem) => {
    if (String(member.userId) === String(myUserId)) return;
    if (member.isExternal === true) void startEM(member);
    else startDM(member);
  };

  const setEmDraftTitle = (title: string) =>
    setEmTitleDraftState(prev => (prev ? { ...prev, title } : prev));

  const cancelEmDraft = () => setEmTitleDraftState(null);

  // 방을 즉시 만들지 않고 draft로 진입 — 첫 메시지 전송 시 POST /app/em (RN 패리티, 취소 시 빈 방 잔존 방지)
  const confirmEmDraft = () => {
    if (!emTitleDraft) return;
    const title = emTitleDraft.title.trim();
    if (!title) return;
    const { member } = emTitleDraft;
    setEmTitleDraftState(null);
    useChatRoomInfo.getState().setChatRoomInfo({
      roomId: '',
      roomName: title,
      channelType: WS_CHANNEL_TYPE.EXTERNAL_MESSAGE,
      totalUserCount: 2,
      otherUserIsExit: false,
      otherUserIsRemoved: false,
      invitedUserIds: [String(member.userId)],
      lastMessage: null,
      initialNotReadCount: 0,
    });
    useChatRoomRuntimeStore.setState({ currentRoomId: null, messages: [] });
    onBeforeNavigate?.();
    router.push('/external-chat/new');
  };

  return { startChat, isCheckingEM, emTitleDraft, setEmDraftTitle, confirmEmDraft, cancelEmDraft };
}
