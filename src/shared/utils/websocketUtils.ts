import {
  WS_CHANNEL_TYPE,
  WS_CHNANNEL_URL_TYPE,
  WebSocketChannelTypes,
  WebSocketChannelUrlTypes,
} from '@/shared/types/websocket';

/**
 * channelType에 맞는 url 요청 경로 반환
 */
export function getChannelUrl(channelType: WebSocketChannelTypes): WebSocketChannelUrlTypes {
  if (channelType === WS_CHANNEL_TYPE.GROUP_MESSAGE) {
    return WS_CHNANNEL_URL_TYPE.GM_CHANNEL_URL;
  }

  if (channelType === WS_CHANNEL_TYPE.EXTERNAL_MESSAGE) {
    return WS_CHNANNEL_URL_TYPE.EM_CHANNEL_URL;
  }

  return WS_CHNANNEL_URL_TYPE.DM_CHANNEL_URL;
}
