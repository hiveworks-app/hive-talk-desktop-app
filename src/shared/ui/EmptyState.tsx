import { cn } from '@/shared/lib/cn';

interface EmptyStateProps {
  /** 안내 문구 (예: "아직 채팅방이 없어요.") */
  message: string;
  /** 컨테이너 추가 클래스 (기본은 부모를 꽉 채워 중앙 정렬) */
  className?: string;
  /** 'sad'(기본): Sad 꿀벌 130px + 14px. 'search': 돋보기 꿀벌 112px + 16px (검색 결과 없음, Figma 743-7517). */
  variant?: 'sad' | 'search';
}

/**
 * 공용 빈 상태 — 꿀벌 일러스트 + 안내 문구. 앱 전역 빈 화면 통일용. 래스터는 public 에서 서빙.
 * - sad   : Img/Worksbee/Sad 130px, 문구 14px Medium #6B7684 (hivetalk-sad.png)
 * - search: Img/Worksbee/Search 112px, 문구 16px #4E5968 (hivetalk-no-find.png)
 */
export function EmptyState({ message, className, variant = 'sad' }: EmptyStateProps) {
  if (variant === 'search') {
    return (
      <div className={cn('flex h-full flex-col items-center justify-center gap-[13px]', className)}>
        <img src="/hivetalk-no-find.png" alt="" className="h-[112px] w-[112px] object-contain" />
        <span className="text-body text-gray-700">{message}</span>
      </div>
    );
  }
  return (
    <div className={cn('flex h-full flex-col items-center justify-center gap-4', className)}>
      <img src="/hivetalk-sad.png" alt="" className="h-[130px] w-[130px] object-contain" />
      <span className="text-sub font-medium text-text-secondary">{message}</span>
    </div>
  );
}
