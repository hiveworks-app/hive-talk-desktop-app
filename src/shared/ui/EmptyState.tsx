import { cn } from '@/shared/lib/cn';

interface EmptyStateProps {
  /** 안내 문구 (예: "아직 채팅방이 없어요.") */
  message: string;
  /** 컨테이너 추가 클래스 (기본은 부모를 꽉 채워 중앙 정렬) */
  className?: string;
  /** 'sad'(기본): Sad 꿀벌. 'search': 돋보기 꿀벌 (검색 결과 없음). */
  variant?: 'sad' | 'search';
}

/**
 * 공용 빈 상태 — 꿀벌 일러스트 + 안내 문구. 앱 전역 빈 화면 통일용. 래스터는 public 에서 서빙.
 * RN Empty 패리티: 이미지 130px + gap-4 + 문구(14px #6B7684) 단일 스타일, variant는 이미지만 교체.
 */
export function EmptyState({ message, className, variant = 'sad' }: EmptyStateProps) {
  const image = variant === 'search' ? '/hivetalk-no-find.png' : '/hivetalk-sad.png';
  return (
    <div className={cn('flex h-full flex-col items-center justify-center gap-4', className)}>
      <img src={image} alt="" className="h-[130px] w-[130px] object-contain" />
      <span className="text-sub font-medium text-text-secondary">{message}</span>
    </div>
  );
}
