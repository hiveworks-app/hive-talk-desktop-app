'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { isOffline } from '@/shared/utils/offlineGuard';
import { IconDescription, IconImage, IconNewLabel } from '@/shared/ui/icons';
import { useUIStore } from '@/store/uiStore';

/** 메시지 최대 입력 길이 (RN 패리티) */
const MAX_MESSAGE_LENGTH = 10000;

interface ChatInputProps {
  onSend: (content: string) => void;
  onFilesSelected: (files: File[]) => void;
  onEditTag?: () => void;
}

export function ChatInput({ onSend, onFilesSelected, onEditTag }: ChatInputProps) {
  const [text, setText] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showSnackbar = useUIStore(s => s.showSnackbar);

  const canSend = text.trim().length > 0;

  // 10,000자 초과 시 잘라내고 안내 (네이티브 maxLength 대신 명시적 피드백 — RN 패리티)
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length > MAX_MESSAGE_LENGTH) {
        setText(value.slice(0, MAX_MESSAGE_LENGTH));
        showSnackbar({ message: '메시지는 최대 10,000자까지 입력할 수 있어요.', state: 'error' });
        return;
      }
      setText(value);
    },
    [showSnackbar],
  );

  const handleSubmit = () => {
    if (!canSend) return;
    onSend(text);
    setText('');
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
    <div className="border-t border-outline">
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

      {/* textarea */}
      <textarea
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder="메시지를 입력하세요."
        rows={3}
        className="w-full resize-none bg-white px-4 py-3 text-sub text-text-primary outline-none placeholder:text-text-placeholder dark:bg-surface"
      />

      {/* 하단 툴바 */}
      <div className="flex items-center justify-between bg-white px-3 pb-2 dark:bg-surface">
        {/* 좌측: 앨범 / 파일 / 태그 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { if (!isOffline()) imageInputRef.current?.click(); }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-gray-100 hover:text-text-secondary"
            title="앨범"
          >
            <IconImage />
          </button>
          <button
            type="button"
            onClick={() => { if (!isOffline()) fileInputRef.current?.click(); }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-gray-100 hover:text-text-secondary"
            title="파일"
          >
            <IconDescription />
          </button>
          <button
            type="button"
            onClick={() => { if (!isOffline()) onEditTag?.(); }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-gray-100 hover:text-text-secondary"
            title="태그"
          >
            <IconNewLabel size={18} />
          </button>
        </div>

        {/* 우측: 전송 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className={cn(
            'shrink-0 rounded-lg px-4 py-1.5 text-sub text-white transition-colors',
            canSend ? 'bg-primary' : 'bg-text-placeholder',
          )}
        >
          전송
        </button>
      </div>
    </div>
  );
}
