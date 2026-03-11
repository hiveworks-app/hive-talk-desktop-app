export interface InviteMessageProps {
  inviteUserId?: string;
  inviteUserIdArray?: string[];
  channelIdOverride?: string;
}

export interface SubscribeMessageProps {
  channelIdOverride?: string;
  channelTypeOverride?: string;
}

export interface ViewInRoomMessageProps {
  channelIdOverride?: string;
}

export interface ExitMessageRoomProps {
  channelIdOverride?: string;
}

export interface FetchMessageProps {
  currentMessage: string;
  isInclusive?: boolean;
  channelIdOverride?: string;
}

export interface PublishMessageProps {
  tagList: string[];
  content: string;
  channelIdOverride?: string;
}

export interface DeleteMessageProps {
  messageId: string;
}

export interface UpdateTagToMessageProps {
  messageId: string;
  tagIdList: string[];
}

export interface RemoveTagMessageProps {
  messageId: string;
  taggingIdList: string[];
}
