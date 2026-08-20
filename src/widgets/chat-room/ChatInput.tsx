'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { isOffline } from '@/shared/utils/offlineGuard';
import { IconFileDefault, IconSend, IconTag, IconUploadImage } from '@assets/icons';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useDraftStore } from '@/store/chat/draftStore';
import { useUIStore } from '@/store/uiStore';

/** 메시지 최대 입력 길이 (RN 패리티) */
const MAX_MESSAGE_LENGTH = 10000;

interface ChatInputProps {
  onSend: (content: string) => void;
  onFilesSelected: (files: File[]) => void;
  onEditTag?: () => void;
}

export function ChatInput({ onSend, onFilesSelected, onEditTag }: ChatInputProps) {
  const roomId = useChatRoomInfo(s => s.roomId);
  // 드래프트 복원 — 방별 미전송 입력 보존 (RN 패리티)
  const [text, setText] = useState(() => useDraftStore.getState().drafts[roomId] ?? '');
  // 방 전환 시 해당 방의 드래프트로 교체 (렌더 중 상태 보정 패턴)
  const [prevRoomId, setPrevRoomId] = useState(roomId);
  if (roomId !== prevRoomId) {
    setPrevRoomId(roomId);
    setText(useDraftStore.getState().drafts[roomId] ?? '');
  }
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showSnackbar = useUIStore(s => s.showSnackbar);
  // DM 상대 회원탈퇴/소속해제 — 입력창 비활성 (정책 dm.md §소속해제/§계정 탈퇴, RN 패리티)
  const otherUserIsRemoved = useChatRoomInfo(s => s.otherUserIsRemoved);

  const canSend = text.trim().length > 0 && !otherUserIsRemoved;

  // 10,000자 초과 시 잘라내고 안내 (네이티브 maxLength 대신 명시적 피드백 — RN 패리티)
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length > MAX_MESSAGE_LENGTH) {
        setText(value.slice(0, MAX_MESSAGE_LENGTH));
        useDraftStore.getState().setDraft(roomId, value.slice(0, MAX_MESSAGE_LENGTH));
        showSnackbar({ message: '메시지는 최대 10,000자까지 입력할 수 있어요.', state: 'error' });
        return;
      }
      setText(value);
      useDraftStore.getState().setDraft(roomId, value);
    },
    [showSnackbar, roomId],
  );

  const handleSubmit = () => {
    if (!canSend) return;
    onSend(text);
    setText('');
    useDraftStore.getState().clearDraft(roomId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        onFilesSelected(Array.from(files));
      }
    },
    [onFilesSelected],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFilesSelected(Array.from(e.target.files));
        e.target.value = '';
      }
    },
    [onFilesSelected],
  );

  return (
    <div className={cn('border-t border-outline', otherUserIsRemoved && 'bg-gray-100')}>
      {/* 숨겨진 파일 inputs */}
      <input
        ref={imageInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,video/*"
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.hwp"
      />

      {/* textarea — 배경 없는 플랫 입력창. 비활성 시엔 셸 전체가 연한 회색으로 덮임 (데스크톱 결정) */}
      <div className={cn('px-3 pt-2', otherUserIsRemoved ? 'bg-transparent' : 'bg-white dark:bg-surface')}>
        <textarea
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={otherUserIsRemoved}
          placeholder={otherUserIsRemoved ? '메시지를 보낼 수 없어요.' : '메시지 입력'}
          rows={3}
          className={cn(
            'w-full resize-none rounded-xl px-4 py-3 text-sub text-text-primary outline-none placeholder:text-text-placeholder bg-transparent',
            otherUserIsRemoved && 'placeholder:text-gray-500',
          )}
        />
      </div>

      {/* 하단 툴바 */}
      <div className={cn('flex items-center justify-between px-3 pb-2', otherUserIsRemoved ? 'bg-transparent' : 'bg-white dark:bg-surface')}>
        {/* 좌측: 앨범 / 파일 / 태그 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { if (!isOffline() && !otherUserIsRemoved) imageInputRef.current?.click(); }}
            className={cn('flex h-8 w-8 items-center justify-center rounded-md transition-opacity', otherUserIsRemoved ? 'text-gray-400' : 'text-[#03C75A] hover:opacity-70 active:opacity-60')}
            title="앨범"
          >
            <IconUploadImage width={22} height={22} />
          </button>
          <button
            type="button"
            onClick={() => { if (!isOffline() && !otherUserIsRemoved) fileInputRef.current?.click(); }}
            className={cn('flex h-8 w-8 items-center justify-center rounded-md transition-opacity', otherUserIsRemoved ? 'text-gray-400' : 'text-[#F04452] hover:opacity-70 active:opacity-60')}
            title="파일"
          >
            <IconFileDefault width={22} height={22} />
          </button>
          <button
            type="button"
            onClick={() => { if (!isOffline() && !otherUserIsRemoved) onEditTag?.(); }}
            className={cn('flex h-8 w-8 items-center justify-center rounded-md transition-opacity', otherUserIsRemoved ? 'text-gray-400' : 'text-primary hover:opacity-70 active:opacity-60')}
            title="태그"
          >
            <IconTag width={18} height={16} />
          </button>
        </div>

        {/* 우측: 전송 버튼 — 파란 사각 + IconSend, 비활성 시 연파랑 축소 (RN 패리티) */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="전송"
          className={cn(
            'flex shrink-0 items-center justify-center transition-all',
            canSend ? 'size-[38px] rounded-xl bg-primary' : 'size-8 rounded-[10px] bg-blue-100',
          )}
        >
          <IconSend width={18} height={18} className={canSend ? 'text-white' : 'text-blue-300'} />
        </button>
      </div>
    </div>
  );
}
