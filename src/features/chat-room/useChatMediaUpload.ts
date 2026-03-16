'use client';

import { useCallback } from 'react';
import { uuidv7 } from 'uuidv7';
import { useChatFileUpload } from '@/features/chat-room/queries';
import { IMAGE_UPLOAD_CONCURRENCY, MAX_IMAGES_PER_MESSAGE } from '@/shared/config/constants';
import { WS_MESSAGE_CONTENT_TYPE } from '@/shared/types/websocket';
import { formatKoreanTime } from '@/shared/utils/formatTimeUtils';
import { useAppWebSocket } from '@/shared/websocket/WebSocketContext';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useUploadProgressStore } from '@/store/chat/uploadProgressStore';
import { chunk, mapWithConcurrency, makeProgressThrottler } from './chatUploadUtils';
import { createVideoThumbnail, createImageThumbnail } from './thumbnailUtils';

export function useChatMediaUpload(sendNewRoomInviteIfNeeded: (roomId: string) => void) {
  const { send } = useAppWebSocket();
  const { channelType } = useChatRoomInfo();
  const currentRoomId = useChatRoomRuntimeStore(s => s.currentRoomId);
  const addLocalMessage = useChatRoomRuntimeStore(s => s.addLocalMessage);
  const patchMessageByFileId = useChatRoomRuntimeStore(s => s.patchMessageByFileId);
  const chatFileUploadMutation = useChatFileUpload();
  const setTransmissionProgress = useUploadProgressStore(s => s.setTransmissionProgress);
  const { buildPublishMessage } = useWebSocketMessageBuilder({ type: channelType, channelId: currentRoomId });

  const uploadOneMedia = useCallback(
    async (file: File) => {
      const isVideo = file.type.startsWith('video/');
      const mimeType = file.type || (isVideo ? 'video/mp4' : 'image/jpeg');

      let thumbFileKey: string | undefined;
      try {
        const thumbBlob = isVideo
          ? await createVideoThumbnail(file, 200)
          : file.type.startsWith('image/')
            ? await createImageThumbnail(file, 200)
            : null;

        if (thumbBlob) {
          const thumbResult = await chatFileUploadMutation.mutateAsync({
            channelType,
            file: new File([thumbBlob], `thumb_${file.name.replace(/\.\w+$/, '.jpg')}`, { type: 'image/jpeg' }),
          });
          thumbFileKey = thumbResult.fileKey;
        }
      } catch (err) {
        console.warn('[Upload] 썸네일 생성 실패 (원본은 계속 진행):', err);
      }

      const originRes = await chatFileUploadMutation.mutateAsync({ channelType, file });

      return {
        path: originRes.fileKey,
        meta: { thumbnail: thumbFileKey ?? '', type: mimeType, size: file.size },
      };
    },
    [chatFileUploadMutation, channelType],
  );

  const sendMediaMessage = useCallback(
    async (files: File[]) => {
      if (!files.length || !currentRoomId) return;
      sendNewRoomInviteIfNeeded(currentRoomId);

      const loginUserId = useAuthStore.getState().user?.id;
      const readUserIds = loginUserId ? [String(loginUserId)] : [];
      const images = files.filter(f => f.type.startsWith('image/'));
      const videos = files.filter(f => f.type.startsWith('video/'));
      const imageChunks = chunk(images, MAX_IMAGES_PER_MESSAGE);

      for (const group of imageChunks) {
        const fileId = uuidv7();
        const total = group.length;
        const createdAt = new Date().toISOString();

        addLocalMessage({
          id: fileId, fileId, isLocal: true, localStatus: 'uploading', dimmed: true,
          messageContentType: WS_MESSAGE_CONTENT_TYPE.IMAGE,
          localUris: group.map(f => URL.createObjectURL(f)),
          text: '', time: formatKoreanTime(createdAt), createdAt, sender: 'me',
          readUserIds, notReadCount: 0, name: '', tags: [], files: [],
        });

        try {
          const throttleProgress = makeProgressThrottler();
          const uploadFileList = await mapWithConcurrency(
            group, IMAGE_UPLOAD_CONCURRENCY, uploadOneMedia,
            (done, total) => {
              throttleProgress({ done, total }, p => {
                setTransmissionProgress(fileId, {
                  done: p.done, total: p.total,
                  status: p.done === p.total ? 'uploaded' : 'uploading',
                });
              });
            },
          );

          setTransmissionProgress(fileId, { done: total, total, status: 'publishing' });
          send(buildPublishMessage({
            type: WS_MESSAGE_CONTENT_TYPE.IMAGE, fileId, tagList: [],
            items: uploadFileList, channelIdOverride: currentRoomId,
          }));
        } catch (e) {
          console.warn('sendMediaMessage upload failed:', e);
          setTransmissionProgress(fileId, { done: 0, total, status: 'failed' });
          patchMessageByFileId(fileId, { localStatus: 'failed', dimmed: true });
        }
      }

      for (const v of videos) {
        const fileId = uuidv7();
        const uploaded = await uploadOneMedia(v);
        send(buildPublishMessage({
          type: WS_MESSAGE_CONTENT_TYPE.MEDIA, fileId, tagList: [],
          items: [uploaded], channelIdOverride: currentRoomId,
        }));
      }
    },
    [currentRoomId, addLocalMessage, uploadOneMedia, send, buildPublishMessage,
      setTransmissionProgress, patchMessageByFileId, sendNewRoomInviteIfNeeded],
  );

  const sendDocumentMessage = useCallback(
    async (files: File[]) => {
      if (!files.length || !currentRoomId) return;
      sendNewRoomInviteIfNeeded(currentRoomId);

      for (const file of files) {
        const mimeType = file.type || 'application/octet-stream';
        const uploadResult = await chatFileUploadMutation.mutateAsync({ channelType, file });
        send(buildPublishMessage({
          type: WS_MESSAGE_CONTENT_TYPE.FILE, tagList: [],
          items: [{ path: uploadResult.fileKey, meta: { type: mimeType, size: file.size } }],
          channelIdOverride: currentRoomId,
        }));
      }
    },
    [currentRoomId, channelType, chatFileUploadMutation, send, buildPublishMessage, sendNewRoomInviteIfNeeded],
  );

  return { sendMediaMessage, sendDocumentMessage };
}
