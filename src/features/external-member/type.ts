export type ExternalInviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED';

export interface ExternalMemberItem {
  userId: number;
  name: string;
  email: string;
  thumbnailProfileUrl?: string;
  inviteStatus: ExternalInviteStatus;
  invitedBy: number;
  invitedAt: string;
  joinedRoomCount: number;
}

export interface ExternalMembersGetPayload {
  items: ExternalMemberItem[];
}

export interface InviteExternalUserRequest {
  email: string;
  name?: string;
}

export interface InviteExternalUserResponse {
  userId: number;
  inviteStatus: ExternalInviteStatus;
}
