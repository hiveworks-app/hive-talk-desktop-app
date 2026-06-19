import { ParticipantItemsType } from '@/shared/types/chatRoom';

export interface EMCreateRequestProps {
  title: string;
  userIdList: string[];
}

export interface EMCreateResponseProps {
  roomId: string;
  creator: string;
  title: string;
  participants: ParticipantItemsType[];
  createdAt: Date;
}

/** 협력방 중복 검사 — 선택 멤버 조합과 동일한 방이 이미 있는지 (RN /app/em/rooms/check-duplicate) */
export interface CheckDuplicateEMRequestProps {
  userIdList: string[];
}

export interface CheckDuplicateEMResponseProps {
  exists: boolean;
  roomIds: string[];
}
