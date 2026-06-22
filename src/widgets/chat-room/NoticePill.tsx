import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface NoticePillProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * 채팅 흐름 내 가운데 정렬 알림 알약 — 날짜 구분선과 시스템 공지(입장/퇴장/제목변경/신고)의 공통 디자인.
 * Figma 1356-35110: bg-black/10, rounded-[10px], px-2.5 py-1.5, 13px. chat-bg 위에 얹힌다.
 */
export function NoticePill({ children, className, ...props }: NoticePillProps) {
  return (
    <div className={cn('flex justify-center', className)} {...props}>
      <span className="rounded-[10px] bg-black/10 px-2.5 py-1.5 text-center text-sub-sm text-gray-900">
        {children}
      </span>
    </div>
  );
}
