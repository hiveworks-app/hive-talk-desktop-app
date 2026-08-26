import type { QueryClient } from '@tanstack/react-query';
import { apiGetDMLastMessage, apiGetGMLastMessage } from '@/features/chat-room/api';
import { fetchDMRoomList, fetchGMRoomList } from '@/features/chat-room-list/queries';
import { DM_ROOM_LIST_KEY, GM_ROOM_LIST_KEY } from '@/shared/config/queryKeys';
import { countDMTotalUsers, countRoomListTotalUsers } from '@/shared/utils/roomUserCount';
import { WS_CHANNEL_TYPE, type WebSocketChannelTypes } from '@/shared/types/websocket';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';

/**
 * 팝업 창(멀티 채팅창) 부트스트랩.
 * 팝업은 URL 직접 로드라 목록 클릭을 거치지 않아 chatRoomInfo가 비어 있다 —
 * DM/GM 목록을 조회해 ChatRoomItem.handleClick과 동일한 방 메타를 구성한다.
 * @returns 방을 찾아 세팅했으면 true, 못 찾으면 false (호출부가 목록으로 복귀)
 */
export async function bootstrapPopupRoom(roomId: string, queryClient: QueryClient): Promise<boolean> {
  // 실패를 조용히 빈 배열로 삼키면 "방 없음"과 구분되지 않는다 — 사유를 남긴다
  const [dmRooms, gmRooms] = await Promise.all([
    queryClient
      .fetchQuery({ queryKey: DM_ROOM_LIST_KEY, queryFn: fetchDMRoomList, staleTime: 1000 * 60 * 5 })
      .catch((err: unknown) => {
        console.error('[popup] DM 목록 조회 실패:', err);
        return [];
      }),
    queryClient
      .fetchQuery({ queryKey: GM_ROOM_LIST_KEY, queryFn: fetchGMRoomList, staleTime: 1000 * 60 * 5 })
      .catch((err: unknown) => {
        console.error('[popup] GM 목록 조회 실패:', err);
        return [];
      }),
  ]);

  let channelType: WebSocketChannelTypes = WS_CHANNEL_TYPE.DIRECT_MESSAGE;
  let room = dmRooms.find(r => r.roomModel.roomId === roomId) ?? null;
  if (!room) {
    room = gmRooms.find(r => r.roomModel.roomId === roomId) ?? null;
    channelType = WS_CHANNEL_TYPE.GROUP_MESSAGE;
  }
  if (!room) {
    console.warn('[popup] 방 미발견:', roomId, `(DM ${dmRooms.length}건 / GM ${gmRooms.length}건 조회됨)`);
    return false;
  }

  const { roomModel, messageList, notReadCount } = room;
  const isDM = channelType === WS_CHANNEL_TYPE.DIRECT_MESSAGE;
  const lastMessageApi = isDM ? apiGetDMLastMessage : apiGetGMLastMessage;
  const lastMsg =
    messageList[0] ?? (await lastMessageApi(roomId).then(r => r.payload).catch(() => null));

  const isOtherUserExit = roomModel.participantDetail?.isExit ?? false;
  useChatRoomInfo.getState().setChatRoomInfo({
    roomId,
    // DM은 상대 이름 우선 (RN 패리티)
    roomName: isDM
      ? roomModel.participantDetail?.name || roomModel.title || '채팅방'
      : roomModel.title ||
        roomModel.participants?.map(p => p.name).join(', ') ||
        '채팅방',
    channelType,
    // GM 목록 participants는 본인 제외 — 단일 유틸로 총원 계산 (RN roomUserCount 패리티)
    totalUserCount: isDM
      ? countDMTotalUsers(isOtherUserExit)
      : countRoomListTotalUsers(channelType, roomModel.participants),
    otherUserIsExit: isOtherUserExit,
    // 방 스코프 플래그 — partial merge라 미지정 시 이전 값이 잔존하므로 명시 재설정 (ChatRoomItem과 동일)
    otherUserIsRemoved: isDM ? (roomModel.participantDetail?.isRemoved ?? false) : false,
    lastMessage: lastMsg ?? null,
    invitedUserIds:
      isDM && isOtherUserExit && roomModel.participantDetail?.userId
        ? [String(roomModel.participantDetail.userId)]
        : [],
    initialNotReadCount: notReadCount,
  });
  return true;
}
