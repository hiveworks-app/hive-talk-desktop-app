'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiGetDmCheck } from '@/features/chat-room-list/api';
import { GetChatRoomListItemType } from '@/features/chat-room-list/type';
import { useCheckDuplicateEM } from '@/features/external-chat/queries';
import { DM_ROOM_LIST_KEY, EM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { roomPath } from '@/shared/hooks/useRoomIdParam';
import type { MemberItem } from '@/shared/types/user';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';
import { countDMTotalUsers } from '@/shared/utils/roomUserCount';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';

/** EM 방 제목 입력 대기 상태 — 대상 멤버 + 입력 중 제목 */
export interface EMTitleDraft {
  member: MemberItem;
  title: string;
}

/** EM 중복 방 발견 상태 — [새로 만들기/기존 방 이동] 선택 대기 (RN DuplicateRoomBottomSheet 패리티) */
export interface EMDuplicate {
  member: MemberItem;
  roomId: string;
  existingTitle: string;
}

interface UseStartMemberChatOptions {
  /** 라우팅 직전 호출 — 열려 있는 프로필 다이얼로그/커서 메뉴를 닫는 용도 */
  onBeforeNavigate?: () => void;
}

/**
 * 멤버 → 1:1 채팅 시작 (프로필 [1:1 채팅] 버튼·우클릭 메뉴·행 더블클릭 공용).
 * - 사내멤버: dedup 3단 — ① DM 목록 캐시 ② 서버 dm-check(내가 나갔던 방 복귀) ③ draft(/chat/new)
 * - 협력멤버: EM 중복검사 → 기존 방 이동, 없으면 방 제목 입력(emTitleDraft) 후 draft(/external-chat/new)
 * 방 생성 API는 여기서 호출하지 않는다 — 첫 메시지 전송 시 ensureRoomId가 생성 (빈 방 잔존 방지).
 */
export function useStartMemberChat({ onBeforeNavigate }: UseStartMemberChatOptions = {}) {
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const myUserId = useAuthStore(s => s.user?.id);
  const { mutateAsync: checkDuplicateEM, isPending: isCheckingEM } = useCheckDuplicateEM();
  const showSnackbar = useUIStore(s => s.showSnackbar);
  // DM dedup 서버 조회(dm-check) 중 — 더블클릭 연타로 중복 진입/조회되지 않게 가드
  const [isCheckingDM, setIsCheckingDM] = useState(false);
  // 협력멤버 1:1 EM 생성 — 방 제목 입력 단계 (RN 제목 입력 화면 대응)
  const [emTitleDraft, setEmTitleDraftState] = useState<EMTitleDraft | null>(null);
  // 중복 방 발견 — 자동 이동하지 않고 [새로 만들기/기존 방 이동]을 묻는다 (RN 바텀시트 패리티)
  const [emDuplicate, setEmDuplicate] = useState<EMDuplicate | null>(null);

  // 기존 DM 방 진입 — 방 스코프 플래그를 실제 값으로 전달 (useCreateRoom.submitDM과 동일 규칙:
  // false 하드코딩은 탈퇴/나간 상대 DM의 입력창·재초대 정책이 풀리는 원인)
  const openExistingDM = (member: MemberItem, room: GetChatRoomListItemType) => {
    const otherIsExit = room.roomModel.participantDetail?.isExit === true;
    useChatRoomInfo.getState().setChatRoomInfo({
      roomId: room.roomModel.roomId,
      roomName: room.roomModel.participantDetail?.name ?? member.name,
      channelType: WS_CHANNEL_TYPE.DIRECT_MESSAGE,
      totalUserCount: countDMTotalUsers(otherIsExit),
      otherUserIsExit: otherIsExit,
      otherUserIsRemoved: room.roomModel.participantDetail?.isRemoved ?? false,
      lastMessage: room.messageList[0] ?? null,
      // 상대가 나간 방이면 메시지 전송 시 자동 재초대 준비 (목록 행 클릭과 동일)
      invitedUserIds: otherIsExit ? [String(member.userId)] : [],
      initialNotReadCount: room.notReadCount ?? 0,
    });
    onBeforeNavigate?.();
    router.push(roomPath('/chat', room.roomModel.roomId));
  };

  // 신규 DM draft 진입 — 방 생성은 첫 메시지 전송 시 ensureRoomId가 수행
  const startDraftDM = (member: MemberItem) => {
    useChatRoomInfo.getState().setChatRoomInfo({
      roomId: '',
      roomName: member.name,
      channelType: WS_CHANNEL_TYPE.DIRECT_MESSAGE,
      totalUserCount: 2,
      otherUserIsExit: false,
      otherUserIsRemoved: false,
      lastMessage: null,
      invitedUserIds: [String(member.userId)],
      initialNotReadCount: 0,
    });
    useChatRoomRuntimeStore.setState({ currentRoomId: null, messages: [] });
    onBeforeNavigate?.();
    router.push('/chat/new');
  };

  // 1:1 DM — dedup 순서: ① 목록 캐시 ② 서버 dm-check ③ 신규 draft (RN moveToDMRoom 패리티).
  // ②가 빠지면 내가 나간 방(캐시엔 없지만 서버엔 존재)이 draft로 진입되고, 첫 메시지의
  // POST /app/dm/{userId}가 "이미 존재하는 채팅방" 에러로 실패한다 (2026-09-03 QA)
  const startDM = async (member: MemberItem) => {
    if (isCheckingDM) return;
    const uid = String(member.userId);
    const dmRooms = queryClient.getQueryData<GetChatRoomListItemType[]>(DM_ROOM_LIST_KEY) ?? [];
    const existing = dmRooms.find(room => {
      if (String(room.roomModel.participantDetail?.userId) === uid) return true;
      return room.roomModel.participants?.some(p => String(p.userId) === uid) ?? false;
    });
    if (existing) {
      openExistingDM(member, existing);
      return;
    }
    setIsCheckingDM(true);
    try {
      const res = await apiGetDmCheck(uid);
      if (res.payload?.roomModel?.roomId) {
        openExistingDM(member, res.payload);
        return;
      }
    } catch {
      // 조회 실패 — draft로 진행, 생성 시 서버가 재검증 (RN과 동일한 관용 처리)
    } finally {
      setIsCheckingDM(false);
    }
    startDraftDM(member);
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
    router.push(roomPath('/external-chat', roomId));
  };

  // 협력멤버 1:1 — DM이 아닌 EM 플로우 (정책 em.md, RN C1 패리티): 중복검사 → 기존 방 이동 / 새 방 제목 입력
  const startEM = async (member: MemberItem) => {
    if (isCheckingEM) return;
    try {
      const res = await checkDuplicateEM([String(member.userId), String(myUserId)].filter(Boolean));
      const { exists, roomIds } = res.payload;
      if (exists && roomIds[0]) {
        // 중복 방 발견 — 자동 이동하지 않고 선택을 묻는다 (RN DuplicateRoomBottomSheet 패리티)
        const cached = queryClient.getQueryData<GetChatRoomListItemType[]>(EM_ROOM_LIST_KEY) ?? [];
        const found = cached.find(r => r.roomModel.roomId === roomIds[0]);
        setEmDuplicate({ member, roomId: roomIds[0], existingTitle: found?.roomModel.title ?? member.name });
        return;
      }
    } catch {
      // 검사 실패는 생성 시 서버가 재검증 (RN §7-C-6 정책) — 안내 후 제목 입력으로 진행
      showSnackbar({ message: '잠시 후 다시 시도해주세요.', state: 'error' });
    }
    // 제목은 비워 시작 — placeholder가 상대 이름을 보여주고, 입력 전에는 [확인] 비활성 (RN 동일)
    setEmTitleDraftState({ member, title: '' });
  };

  /** 1:1 채팅 시작 — 사내=DM, 협력=EM. 본인 대상은 무시 */
  const startChat = (member: MemberItem) => {
    if (String(member.userId) === String(myUserId)) return;
    if (member.isExternal === true) void startEM(member);
    else void startDM(member);
  };

  // 중복 안내 선택지 (RN 바텀시트 두 버튼 대응)
  const duplicateCreateNew = () => {
    if (!emDuplicate) return;
    const { member } = emDuplicate;
    setEmDuplicate(null);
    setEmTitleDraftState({ member, title: '' });
  };
  const duplicateGoExisting = () => {
    if (!emDuplicate) return;
    const { member, roomId, existingTitle } = emDuplicate;
    setEmDuplicate(null);
    enterEMRoom(member, roomId, existingTitle);
  };
  const closeEmDuplicate = () => setEmDuplicate(null);

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

  return {
    startChat,
    isCheckingEM,
    emTitleDraft,
    setEmDraftTitle,
    confirmEmDraft,
    cancelEmDraft,
    emDuplicate,
    duplicateCreateNew,
    duplicateGoExisting,
    closeEmDuplicate,
  };
}
