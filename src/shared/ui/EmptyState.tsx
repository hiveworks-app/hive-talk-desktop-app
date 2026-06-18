import { cn } from '@/shared/lib/cn';

interface EmptyStateProps {
  /** 안내 문구 (예: "아직 채팅방이 없어요.") */
  message: string;
  /** 컨테이너 추가 클래스 (기본은 부모를 꽉 채워 중앙 정렬) */
  className?: string;
}

/**
 * 공용 빈 상태 — Sad 꿀벌 일러스트 + 안내 문구.
 * 앱 전역 빈 화면을 통일하기 위한 컴포넌트 (Figma Img/Worksbee/Sad 130px,
 * 문구 14px Medium #6B7684). 래스터는 public/hivetalk-sad.png 에서 서빙.
 */
export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div className={cn('flex h-full flex-col items-center justify-center gap-4', className)}>
      <img src="/hivetalk-sad.png" alt="" className="h-[130px] w-[130px] object-contain" />
      <span className="text-sub font-medium text-text-secondary">{message}</span>
    </div>
  );
}
