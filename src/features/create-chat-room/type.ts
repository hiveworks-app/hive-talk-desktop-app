import { ParticipantDetailType, ParticipantItemsType } from '@/shared/types/chatRoom';

/** DM Create Request Props */
export interface DMCreateRequestProps {
  userId: string;
}

/** DM Create Response Props */
export interface DMCreateResponseProps {
  roomId: string;
  creator: string;
  title: string;
  participants?: ParticipantItemsType[];
  participantDetail?: ParticipantDetailType;
  createdAt: Date;
}

/** GM Create Request Props */
export interface GMCreateRequestProps {
  title: string;
  userIdList: string[];
}

/** GM Create Response Props */
export interface GMCreateResponseProps {
  roomId: string;
  creator: string;
  title: string;
  participants: ParticipantItemsType[];
  createdAt: Date;
}
