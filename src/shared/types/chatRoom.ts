export interface RoomModelType {
  title: string;
  roomId: string;
  creator: number;
  createdAt: string;
  participants?: ParticipantItemsType[];
  participantDetail?: ParticipantDetailType;
}

export interface ParticipantItemsType {
  userId: string;
  name: string;
  thumbnailProfileUrl: string | null;
  pushEnabled: boolean;
}

export interface ParticipantDetailType extends ParticipantItemsType {
  isExit: boolean;
}
