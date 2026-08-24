'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { isOffline } from '@/shared/utils/offlineGuard';
import { IconFileDefault, IconSend, IconTag, IconUploadImage } from '@assets/icons';
import { useChatRoomInfo } from '@/store/chat/chatRoomStore';
import { useDraftStore } from '@/store/chat/draftStore';
import { useUIStore } from '@/store/uiStore';

/** 메시지 최대 입력 길이 (RN 패리티) */
const MAX_MESSAGE_LENGTH = 10000;

/* 입력창 자동 확장 — RN INPUT_MAX_LINES(8) 패리티.
   RN은 22px 행간 기준 8줄(176)이고, 데스크톱 text-body는 14/20이라 행간이 다르다.
   px를 복사하지 않고 "8줄"이라는 규칙만 가져와 데스크톱 스케일로 다시 계산한다. */
const INPUT_LINE_HEIGHT = 20; // text-body line-height
const INPUT_MAX_LINES = 8;
const INPUT_VERTICAL_PADDING = 12; // py-1.5 (6 + 6)
const INPUT_MAX_HEIGHT = INPUT_LINE_HEIGHT * INPUT_MAX_LINES + INPUT_VERTICAL_PADDING;

/* 높이 재계산은 페인트 전에 끝나야 한다 — useEffect면 드래프트가 있는 방에 들어갈 때
   1줄로 한 프레임 그려졌다가 늘어나 깜빡인다. 서버 렌더에서는 layout effect가 경고를 내므로 분기. */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showSnackbar = useUIStore(s => s.showSnackbar);
  // DM 상대 회원탈퇴/소속해제 — 입력창 비활성 (정책 dm.md §소속해제/§계정 탈퇴, RN 패리티)
  const otherUserIsRemoved = useChatRoomInfo(s => s.otherUserIsRemoved);

  const canSend = text.trim().length > 0 && !otherUserIsRemoved;

  // DOM 레이아웃 동기화 — 입력값이 바뀔 때마다 내용 높이를 다시 재 1~8줄 사이로 맞춘다.
  // 타이핑·드래프트 복원·방 전환·전송 후 비우기가 전부 text 변경이라 이 하나로 수렴한다.
  useIsomorphicLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    // 줄이 줄어든 경우에도 다시 측정되도록 먼저 높이를 해제한다 (scrollHeight는 줄어들지 않음)
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [text]);

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
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={otherUserIsRemoved}
          placeholder={otherUserIsRemoved ? '메시지를 보낼 수 없어요.' : '메시지 입력'}
          // 높이는 useIsomorphicLayoutEffect가 내용에 맞춰 잡는다 — rows는 첫 페인트 기준선(1줄)
          rows={1}
          className={cn(
            // 래퍼(px-3)와 패딩 중복 제거 — 안쪽은 최소만 (사용자 조정 2026-08-21)
            // text-body = 말풍선 본문과 같은 크기. RN도 입력창·버블이 동일 크기라, 여기만 작으면
            // 입력할 때(13px)와 보낸 뒤(14px) 글자가 커지는 것처럼 보인다.
            'w-full resize-none rounded-xl px-1 py-1.5 text-body text-text-primary outline-none placeholder:text-text-placeholder bg-transparent',
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
            className={cn('flex h-8 w-8 items-center justify-center rounded-md transition-opacity', otherUserIsRemoved ? 'text-gray-400' : 'text-state-success hover:opacity-70 active:opacity-60')}
            title="앨범"
          >
            <IconUploadImage width={22} height={22} />
          </button>
          <button
            type="button"
            onClick={() => { if (!isOffline() && !otherUserIsRemoved) fileInputRef.current?.click(); }}
            className={cn('flex h-8 w-8 items-center justify-center rounded-md transition-opacity', otherUserIsRemoved ? 'text-gray-400' : 'text-state-error hover:opacity-70 active:opacity-60')}
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

        {/* 우측: 전송 버튼 — 크기 고정 32px, 색상만 활성 전환.
            RN은 활성 시 38px로 커지지만 데스크톱에선 크기 전환이 깜빡임으로 보여 제거 (사용자 결정 2026-08-21) */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="전송"
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-[10px] transition-colors',
            canSend ? 'bg-primary' : 'bg-blue-100',
          )}
        >
          <IconSend width={18} height={18} className={cn('transition-colors', canSend ? 'text-white' : 'text-blue-300')} />
        </button>
      </div>
    </div>
  );
}
