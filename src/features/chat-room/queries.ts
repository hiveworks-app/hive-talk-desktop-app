import { useMutation } from '@tanstack/react-query';
import { apiDMFileUpload, apiGMFileUpload, apiEMFileUpload } from '@/features/chat-room/api';
import { ChatFileUploadResponsePayload, UploadChatFileProps } from '@/features/chat-room/type';
import { uploadToPresignedUrl } from '@/shared/api';
import { WS_CHANNEL_TYPE } from '@/shared/types/websocket';

const UPLOAD_API_MAP = {
  [WS_CHANNEL_TYPE.DIRECT_MESSAGE]: apiDMFileUpload,
  [WS_CHANNEL_TYPE.GROUP_MESSAGE]: apiGMFileUpload,
  [WS_CHANNEL_TYPE.EXTERNAL_MESSAGE]: apiEMFileUpload,
};

export const useChatFileUpload = () => {
  return useMutation<ChatFileUploadResponsePayload, Error, UploadChatFileProps>({
    mutationFn: async ({ channelType, file }) => {
      const uploadApi = UPLOAD_API_MAP[channelType];
      if (!uploadApi) {
        throw new Error(`지원하지 않는 채널 타입입니다: ${channelType}`);
      }

      const fileName = file.name;

      // 1) Presigned URL 요청
      const res = await uploadApi({ fileName });
      const payload = res.payload;
      const { putPresignedUrl } = payload;

      if (!putPresignedUrl) {
        throw new Error('Presigned URL을 받아오지 못했습니다.');
      }

      // 2) S3 PUT 업로드
      const contentType = file.type || 'application/octet-stream';
      await uploadToPresignedUrl(putPresignedUrl, file, contentType);

      return payload;
    },
  });
};
