'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChatRoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[ChatRoomError]', error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-text-primary">채팅방 오류</h3>
        <p className="max-w-sm text-sm text-text-secondary">
          채팅방을 불러오는 중 오류가 발생했습니다.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => router.replace('/chat')}
            className="rounded-lg border border-divider px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-gray-50"
          >
            채팅 목록으로
          </button>
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
          >
            다시 시도
          </button>
        </div>
      </div>
    </div>
  );
}
