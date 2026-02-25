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
