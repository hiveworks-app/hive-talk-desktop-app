'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { uuidv7 } from 'uuidv7';
import { getSidePanelParticipantsQuery } from '@/features/chat-room-side-panel/queries';
import { useChatFileUpload } from '@/features/chat-room/queries';
import { IMAGE_UPLOAD_CONCURRENCY, MAX_IMAGES_PER_MESSAGE } from '@/shared/config/constants';
import {
  WS_MESSAGE_CONTENT_TYPE,
  RemoveTagMessageProps,
  UpdateTagToMessageProps,
} from '@/shared/types/websocket';
import { formatKoreanTime } from '@/shared/utils/formatTimeUtils';
import { useAppWebSocket } from '@/shared/websocket/WebSocketContext';
import { useWebSocketMessageBuilder } from '@/shared/websocket/useWebSocketMessageBuilder';
import { useAuthStore } from '@/store/auth/authStore';
import { useChatRoomRuntimeStore } from '@/store/chat/chatRoomRuntimeStore';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useUploadProgressStore } from '@/store/chat/uploadProgressStore';
import { chunk, mapWithConcurrency, makeProgressThrottler } from './chatUploadUtils';
import { createVideoThumbnail, createImageThumbnail } from './thumbnailUtils';

type ChatScrollDirection = 'before' | 'after';

export const useChatRoomActions = () => {
  const queryClient = useQueryClient();
  const { send } = useAppWebSocket();
  const { channelType } = useChatRoomInfo();
  const currentRoomId = useChatRoomRuntimeStore(s => s.currentRoomId);
  const setLoading = useChatRoomRuntimeStore(s => s.setLoading);
  const setNextMyTags = useChatRoomRuntimeStore(s => s.setNextMyTags);
  const addLocalMessage = useChatRoomRuntimeStore(s => s.addLocalMessage);
  const patchMessageByFileId = useChatRoomRuntimeStore(s => s.patchMessageByFileId);
  const chatFileUploadMutation = useChatFileUpload();
  const setTransmissionProgress = useUploadProgressStore(s => s.setTransmissionProgress);

  const {
    buildInviteMessage,
    buildFetchBeforeMessage,
    buildFetchAfterMessage,
    buildPublishMessage,
    buildAddTagToMessage,
    buildRemoveTagToMessage,
    buildDeleteMessage,
  } = useWebSocketMessageBuilder({
    type: channelType,
    channelId: currentRoomId,
  });

  // 🔹 사용자 초대 (모바일 패턴과 동일)
  const sendInvite = useCallback(
    (userIds: string[], roomId?: string) => {
      if (!userIds || userIds.length === 0) return;
      if (userIds.length === 1) {
        send(buildInviteMessage({ inviteUserId: userIds[0], channelIdOverride: roomId }));
      } else {
        send(buildInviteMessage({ inviteUserIdArray: userIds, channelIdOverride: roomId }));
      }
    },
    [buildInviteMessage, send],
  );

  // ─── 신규 방 INVITE (모바일 ensureRoomId 패턴 - PUB 전 호출) ───
  // 데스크톱은 방을 미리 생성하므로 ensureRoomId가 불필요하지만,
  // 신규 방에서 첫 메시지 시 INVITE를 보내는 역할은 동일
  const sendNewRoomInviteIfNeeded = useCallback(
    (roomId: string) => {
      const { invitedUserIds, otherUserIsExit } = useChatRoomInfo.getState();
      // 신규 방: invitedUserIds 있고 otherUserIsExit 아님
      if (invitedUserIds.length > 0 && !otherUserIsExit) {
        sendInvite(invitedUserIds, roomId);
        useChatRoomInfo.setState({ invitedUserIds: [] });

        // INVITE 후 participants prefetch (서버 처리 시간 고려)
        setTimeout(() => {
          queryClient
            .prefetchQuery(getSidePanelParticipantsQuery(roomId, channelType))
            .catch(() => {});
        }, 500);
      }
    },
    [sendInvite, queryClient, channelType],
  );

  // ─── 텍스트 메시지 전송 (모바일 handleSendText 패턴) ───
  const sendTextMessage = useCallback(
    (content: string, tagList: string[] = []) => {
      if (!content.trim() || !currentRoomId) return;

      if (tagList.length > 0) {
        setNextMyTags(
          tagList.map(tagId => ({
            tagId: Number(tagId),
            categoryId: 0,
            categoryCode: '',
            categoryTitle: '',
            categoryDescription: '',
            code: '',
            title: '',
            description: '',
          })),
        );
      }

      // 1) 신규 방: PUB 전 INVITE (모바일 ensureRoomId 패턴)
      sendNewRoomInviteIfNeeded(currentRoomId);

      // 2) PUB
      send(
        buildPublishMessage({
          type: WS_MESSAGE_CONTENT_TYPE.TEXT,
          content,
          tagList,
          channelIdOverride: currentRoomId,
        }),
      );

      // 3) 기존 방 상대 나감: PUB 후 INVITE (모바일 handleSendText 패턴)
      const { otherUserIsExit, invitedUserIds } = useChatRoomInfo.getState();
      if (otherUserIsExit && invitedUserIds.length > 0) {
        sendInvite(invitedUserIds, currentRoomId);
        useChatRoomInfo.setState({ otherUserIsExit: false });
      }
    },
    [send, buildPublishMessage, currentRoomId, setNextMyTags, sendNewRoomInviteIfNeeded, sendInvite],
  );

  // ─── 이전 메시지 더보기 ───
  const loadMoreBeforeMessage = useCallback(
    (direction: ChatScrollDirection = 'before') => {
      const { messages, loading } = useChatRoomRuntimeStore.getState();
      if (messages.length === 0) return;

      if (direction === 'before') {
        if (loading.isBeforeLoading || !loading.hasMoreBefore) return;
        setLoading({ isBeforeLoading: true });
        const firstId = messages[0]?.id;
        if (firstId) {
          send(
            buildFetchBeforeMessage({
              currentMessage: firstId,
              isInclusive: false,
              channelIdOverride: currentRoomId ?? undefined,
            }),
          );
        }
      }
    },
    [send, buildFetchBeforeMessage, currentRoomId, setLoading],
  );

  // ─── 이후 메시지 더보기 ───
  const loadMoreAfterMessage = useCallback(() => {
    const { messages, loading } = useChatRoomRuntimeStore.getState();
    if (messages.length === 0) return;
    if (loading.isAfterLoading || !loading.hasMoreAfter) return;

    setLoading({ isAfterLoading: true });
    const lastId = messages[messages.length - 1]?.id;
    if (lastId) {
      send(
        buildFetchAfterMessage({
          currentMessage: lastId,
          isInclusive: false,
          channelIdOverride: currentRoomId ?? undefined,
        }),
      );
    }
  }, [send, buildFetchAfterMessage, currentRoomId, setLoading]);

  // ─── 단일 미디어(이미지/비디오) 업로드 ───
  const uploadOneMedia = useCallback(
    async (file: File) => {
      const isVideo = file.type.startsWith('video/');
      const mimeType = file.type || (isVideo ? 'video/mp4' : 'image/jpeg');

      // 썸네일 생성 (이미지: Canvas 리사이즈, 동영상: 첫 프레임 캡처)
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

      // 원본 업로드
      const originRes = await chatFileUploadMutation.mutateAsync({
        channelType,
        file,
      });

      return {
        path: originRes.fileKey,
        meta: {
          thumbnail: thumbFileKey ?? '',
          type: mimeType,
          size: file.size,
        },
      };
    },
    [chatFileUploadMutation, channelType],
  );

  // ─── 미디어(이미지/비디오) 메시지 전송 (모바일: ensureRoomId만, otherUserIsExit 체크 없음) ───
  const sendMediaMessage = useCallback(
    async (files: File[]) => {
      if (!files.length || !currentRoomId) return;

      // 신규 방 INVITE만 (모바일 ensureRoomId 패턴)
      sendNewRoomInviteIfNeeded(currentRoomId);

      const loginUserId = useAuthStore.getState().user?.id;
      const readUserIds = loginUserId ? [String(loginUserId)] : [];

      const images = files.filter(f => f.type.startsWith('image/'));
      const videos = files.filter(f => f.type.startsWith('video/'));

      // 이미지: MAX_IMAGES_PER_MESSAGE 단위로 묶어 한 메시지
      const imageChunks = chunk(images, MAX_IMAGES_PER_MESSAGE);

      for (const group of imageChunks) {
        const fileId = uuidv7();
        const total = group.length;
        const createdAt = new Date().toISOString();

        // 낙관적 로컬 메시지 추가
        addLocalMessage({
          id: fileId,
          fileId,
          isLocal: true,
          localStatus: 'uploading',
          dimmed: true,
          messageContentType: WS_MESSAGE_CONTENT_TYPE.IMAGE,
          localUris: group.map(f => URL.createObjectURL(f)),
          text: '',
          time: formatKoreanTime(createdAt),
          createdAt,
          sender: 'me',
          readUserIds,
          notReadCount: 0,
          name: '',
          tags: [],
          files: [],
        });

        try {
          const throttleProgress = makeProgressThrottler();

          const uploadFileList = await mapWithConcurrency(
            group,
            IMAGE_UPLOAD_CONCURRENCY,
            uploadOneMedia,
            (done, total) => {
              throttleProgress({ done, total }, p => {
                setTransmissionProgress(fileId, {
                  done: p.done,
                  total: p.total,
                  status: p.done === p.total ? 'uploaded' : 'uploading',
                });
              });
            },
          );

          setTransmissionProgress(fileId, { done: total, total, status: 'publishing' });

          send(
            buildPublishMessage({
              type: WS_MESSAGE_CONTENT_TYPE.IMAGE,
              fileId,
              tagList: [],
              items: uploadFileList,
              channelIdOverride: currentRoomId,
            }),
          );
        } catch (e) {
          console.warn('sendMediaMessage upload failed:', e);
          setTransmissionProgress(fileId, { done: 0, total, status: 'failed' });
          patchMessageByFileId(fileId, { localStatus: 'failed', dimmed: true });
        }
      }

      // 비디오: 1개씩 메시지 1개
      for (const v of videos) {
        const fileId = uuidv7();
        const uploaded = await uploadOneMedia(v);

        send(
          buildPublishMessage({
            type: WS_MESSAGE_CONTENT_TYPE.MEDIA,
            fileId,
            tagList: [],
            items: [uploaded],
            channelIdOverride: currentRoomId,
          }),
        );
      }
    },
    [
      currentRoomId,
      addLocalMessage,
      uploadOneMedia,
      send,
      buildPublishMessage,
      setTransmissionProgress,
      patchMessageByFileId,
      sendNewRoomInviteIfNeeded,
    ],
  );

  // ─── 파일(문서) 메시지 전송 (모바일: ensureRoomId만, otherUserIsExit 체크 없음) ───
  const sendDocumentMessage = useCallback(
    async (files: File[]) => {
      if (!files.length || !currentRoomId) return;

      // 신규 방 INVITE만 (모바일 ensureRoomId 패턴)
      sendNewRoomInviteIfNeeded(currentRoomId);

      for (const file of files) {
        const mimeType = file.type || 'application/octet-stream';

        const uploadResult = await chatFileUploadMutation.mutateAsync({
          channelType,
          file,
        });

        const uploadFileItem = {
          path: uploadResult.fileKey,
          meta: {
            type: mimeType,
            size: file.size,
          },
        };

        send(
          buildPublishMessage({
            type: WS_MESSAGE_CONTENT_TYPE.FILE,
            tagList: [],
            items: [uploadFileItem],
            channelIdOverride: currentRoomId,
          }),
        );
      }
    },
    [currentRoomId, channelType, chatFileUploadMutation, send, buildPublishMessage, sendNewRoomInviteIfNeeded],
  );

  // ─── 메시지 삭제 ───
  const deleteMessage = useCallback(
    (messageId: string) => {
      send(buildDeleteMessage({ messageId }));
    },
    [send, buildDeleteMessage],
  );

  // ─── 태그 추가 ───
  const addTagToMessage = useCallback(
    (params: UpdateTagToMessageProps) => {
      send(buildAddTagToMessage(params));
    },
    [send, buildAddTagToMessage],
  );

  // ─── 태그 삭제 ───
  const removeTagFromMessage = useCallback(
    (params: RemoveTagMessageProps) => {
      useChatRoomRuntimeStore.getState().setPendingRemoveTagMessageId(params.messageId);
      send(buildRemoveTagToMessage(params));
    },
    [send, buildRemoveTagToMessage],
  );

  return {
    sendTextMessage,
    loadMoreBeforeMessage,
    loadMoreAfterMessage,
    sendMediaMessage,
    sendDocumentMessage,
    deleteMessage,
    addTagToMessage,
    removeTagFromMessage,
  };
};

