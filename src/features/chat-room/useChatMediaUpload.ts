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
import { createVideoThumbnail, prepareChatImage } from './thumbnailUtils';

/**
 * 실패한 미디어/파일 재전송용 원본 File 보관 — RN retryPayload/retryFilePayload 대응.
 * File 객체는 직렬화 불가라 메모리에만 보관한다 (새로고침 시 소실 → 재전송 불가, 삭제만 가능).
 * fileId(uuidv7)는 전역 유일이므로 모듈 스코프 단일 Map 공유가 안전하다.
 */
const pendingMediaRetryFiles = new Map<string, { kind: 'media' | 'document'; files: File[] }>();

/**
 * 업로드 진행 중 사용자가 X를 눌러 취소한 fileId 집합 — 모듈 스코프 공유 (RN 패리티).
 * 전송 루프는 방 이탈 후에도 옛 클로저로 계속 돌 수 있으므로, 훅 인스턴스가 아닌
 * 모듈 스코프 Set을 공유해야 재마운트 후에도 취소가 무력화되지 않는다.
 */
const cancelledFileIds = new Set<string>();

/**
 * 업로드 취소 — 로컬 버블/진행률/재전송 원본을 모두 정리하고, 진행 중인 루프는
 * 가드 지점(업로드 시작 전·publish 직전)에서 이 fileId를 보고 후속 동작을 스킵한다.
 */
export const cancelMediaUpload = (messageId: string) => {
  const msg = useChatRoomRuntimeStore.getState().messages.find(m => m.id === messageId);
  const fileId = msg?.fileId ?? messageId;
  cancelledFileIds.add(fileId);
  useUploadProgressStore.getState().clearProgress(fileId);
  pendingMediaRetryFiles.delete(fileId);
  useChatRoomRuntimeStore.getState().removeMessageById(messageId);
};

/** 실패 메시지 '삭제' 시 재전송 원본 정리 (useChatRoomActions.removeFailedMessage에서 호출) */
export const discardMediaRetryFiles = (fileId?: string | null) => {
  if (fileId) pendingMediaRetryFiles.delete(fileId);
};

export function useChatMediaUpload(
  sendNewRoomInviteIfNeeded: (roomId: string) => void,
  ensureRoomId: () => Promise<string | null>,
) {
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

      // RN IMAGE_PROCESS_OPTS 파리티 — 이미지: 썸네일 360 상시 + 0.5MB 초과 원본 1600/q0.7 압축.
      // 전처리 실패(디코드 불가 등) 시 원본 그대로 진행 (썸네일 없이).
      let uploadFile = file;
      let thumbBlob: Blob | null = null;
      try {
        if (isVideo) {
          thumbBlob = await createVideoThumbnail(file, 200);
        } else if (file.type.startsWith('image/')) {
          const prepared = await prepareChatImage(file);
          uploadFile = prepared.original;
          thumbBlob = prepared.thumbnail;
        }
      } catch (err) {
        console.warn('[Upload] 미디어 전처리 실패 (원본 그대로 진행):', err);
      }

      let thumbFileKey: string | undefined;
      if (thumbBlob) {
        try {
          const thumbResult = await chatFileUploadMutation.mutateAsync({
            channelType,
            file: new File([thumbBlob], `thumb_${file.name.replace(/\.\w+$/, '.jpg')}`, { type: 'image/jpeg' }),
          });
          thumbFileKey = thumbResult.fileKey;
        } catch (err) {
          console.warn('[Upload] 썸네일 업로드 실패 (원본은 계속 진행):', err);
        }
      }

      const originRes = await chatFileUploadMutation.mutateAsync({ channelType, file: uploadFile });
      const mimeType = uploadFile.type || (isVideo ? 'video/mp4' : 'image/jpeg');

      return {
        path: originRes.fileKey,
        meta: { thumbnail: thumbFileKey ?? '', type: mimeType, size: uploadFile.size },
      };
    },
    [chatFileUploadMutation, channelType],
  );

  const resolveRoomId = useCallback(
    async (): Promise<string | null> => {
      const runtimeRoomId = useChatRoomRuntimeStore.getState().currentRoomId;
      if (runtimeRoomId) return runtimeRoomId;
      return ensureRoomId();
    },
    [ensureRoomId],
  );

  const sendMediaMessage = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const roomId = await resolveRoomId();
      if (!roomId) return;
      sendNewRoomInviteIfNeeded(roomId);

      const loginUserId = useAuthStore.getState().user?.id;
      const readUserIds = loginUserId ? [String(loginUserId)] : [];
      const images = files.filter(f => f.type.startsWith('image/'));
      const videos = files.filter(f => f.type.startsWith('video/'));
      const imageChunks = chunk(images, MAX_IMAGES_PER_MESSAGE);

      for (const group of imageChunks) {
        const fileId = uuidv7();
        const total = group.length;
        const createdAt = new Date().toISOString();
        pendingMediaRetryFiles.set(fileId, { kind: 'media', files: group });

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

          // 🛑 취소 가드: 업로드 완료했더라도 publish 직전 취소면 발행 스킵 (RN 패리티)
          if (cancelledFileIds.has(fileId)) {
            cancelledFileIds.delete(fileId);
            continue;
          }
          setTransmissionProgress(fileId, { done: total, total, status: 'publishing' });
          send(buildPublishMessage({
            type: WS_MESSAGE_CONTENT_TYPE.IMAGE, fileId, tagList: [],
            items: uploadFileList, channelIdOverride: roomId,
          }));
          pendingMediaRetryFiles.delete(fileId);
        } catch (e) {
          if (cancelledFileIds.has(fileId)) {
            cancelledFileIds.delete(fileId);
            continue;
          }
          console.warn('sendMediaMessage upload failed:', e);
          setTransmissionProgress(fileId, { done: 0, total, status: 'failed' });
          patchMessageByFileId(fileId, { localStatus: 'failed', dimmed: true });
        }
      }

      for (const v of videos) {
        const fileId = uuidv7();
        const createdAt = new Date().toISOString();
        pendingMediaRetryFiles.set(fileId, { kind: 'media', files: [v] });

        // 로컬 버블 미리보기 — 동영상 원본 objectURL은 <img>로 못 그리므로 썸네일 먼저 시도
        let previewUri: string;
        try {
          const thumbBlob = await createVideoThumbnail(v, 200);
          previewUri = thumbBlob ? URL.createObjectURL(thumbBlob) : URL.createObjectURL(v);
        } catch {
          previewUri = URL.createObjectURL(v);
        }

        addLocalMessage({
          id: fileId, fileId, isLocal: true, localStatus: 'uploading', dimmed: true,
          messageContentType: WS_MESSAGE_CONTENT_TYPE.MEDIA,
          localUris: [previewUri],
          text: '', time: formatKoreanTime(createdAt), createdAt, sender: 'me',
          readUserIds, notReadCount: 0, name: '', tags: [], files: [],
        });

        try {
          setTransmissionProgress(fileId, { done: 0, total: 1, status: 'uploading' });
          const uploaded = await uploadOneMedia(v);
          // 🛑 취소 가드: publish 직전 (RN 패리티)
          if (cancelledFileIds.has(fileId)) {
            cancelledFileIds.delete(fileId);
            continue;
          }
          setTransmissionProgress(fileId, { done: 1, total: 1, status: 'publishing' });
          send(buildPublishMessage({
            type: WS_MESSAGE_CONTENT_TYPE.MEDIA, fileId, tagList: [],
            items: [uploaded], channelIdOverride: roomId,
          }));
          pendingMediaRetryFiles.delete(fileId);
        } catch (e) {
          if (cancelledFileIds.has(fileId)) {
            cancelledFileIds.delete(fileId);
            continue;
          }
          console.warn('sendMediaMessage(video) upload failed:', e);
          setTransmissionProgress(fileId, { done: 0, total: 1, status: 'failed' });
          patchMessageByFileId(fileId, { localStatus: 'failed', dimmed: true });
        }
      }
    },
    [addLocalMessage, uploadOneMedia, send, buildPublishMessage,
      setTransmissionProgress, patchMessageByFileId, sendNewRoomInviteIfNeeded, resolveRoomId],
  );

  const sendDocumentMessage = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const roomId = await resolveRoomId();
      if (!roomId) return;
      sendNewRoomInviteIfNeeded(roomId);

      const loginUserId = useAuthStore.getState().user?.id;
      const readUserIds = loginUserId ? [String(loginUserId)] : [];

      // 파일은 여러 개 선택하더라도 1개씩 업로드 후 1메시지씩 전송 (RN 패리티)
      for (const file of files) {
        const fileId = uuidv7();
        const createdAt = new Date().toISOString();
        const mimeType = file.type || 'application/octet-stream';
        pendingMediaRetryFiles.set(fileId, { kind: 'document', files: [file] });

        addLocalMessage({
          id: fileId, fileId, isLocal: true, localStatus: 'uploading', dimmed: true,
          messageContentType: WS_MESSAGE_CONTENT_TYPE.FILE,
          text: '', time: formatKoreanTime(createdAt), createdAt, sender: 'me',
          readUserIds, notReadCount: 0, name: '', tags: [],
          // 업로드 완료 전이므로 path는 파일명 placeholder — ChatFileCard가 이름/용량 표시에 사용
          files: [{ path: file.name, meta: { type: mimeType, size: file.size, thumbnail: '', thumbnailPresignedUrl: '' } }],
        });

        try {
          const uploadResult = await chatFileUploadMutation.mutateAsync({ channelType, file });
          // 🛑 취소 가드: publish 직전 (RN 패리티)
          if (cancelledFileIds.has(fileId)) {
            cancelledFileIds.delete(fileId);
            continue;
          }
          send(buildPublishMessage({
            type: WS_MESSAGE_CONTENT_TYPE.FILE, fileId, tagList: [],
            items: [{ path: uploadResult.fileKey, meta: { type: mimeType, size: file.size } }],
            channelIdOverride: roomId,
          }));
          pendingMediaRetryFiles.delete(fileId);
        } catch (e) {
          if (cancelledFileIds.has(fileId)) {
            cancelledFileIds.delete(fileId);
            continue;
          }
          console.warn('sendDocumentMessage upload failed:', e);
          patchMessageByFileId(fileId, { localStatus: 'failed', dimmed: true });
        }
      }
    },
    [channelType, chatFileUploadMutation, send, buildPublishMessage, sendNewRoomInviteIfNeeded, resolveRoomId, addLocalMessage, patchMessageByFileId],
  );

  /**
   * 실패한 미디어/파일 재전송 — 보관된 원본 File로 전체 플로우 재실행.
   * 기존 로컬 버블은 제거되고 새 fileId·현재 시각으로 맨 아래에 다시 추가된다 (텍스트 재전송과 동일 정책).
   * 반환 false = 이 메시지는 미디어 재전송 대상이 아님 (텍스트 재전송으로 폴백).
   */
  const retryMediaMessage = useCallback(
    (messageId: string): boolean => {
      const msg = useChatRoomRuntimeStore.getState().messages.find(m => m.id === messageId);
      const fileId = msg?.fileId;
      if (!msg?.isLocal || !fileId) return false;
      const entry = pendingMediaRetryFiles.get(fileId);
      if (!entry) return false;
      pendingMediaRetryFiles.delete(fileId);
      useChatRoomRuntimeStore.getState().removeLocalMessage(fileId);
      if (entry.kind === 'document') void sendDocumentMessage(entry.files);
      else void sendMediaMessage(entry.files);
      return true;
    },
    [sendMediaMessage, sendDocumentMessage],
  );

  return { sendMediaMessage, sendDocumentMessage, retryMediaMessage };
}
