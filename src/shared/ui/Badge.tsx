import { cn } from '@/shared/lib/cn';

interface BadgeProps {
  count: number;
  max?: number;
  className?: string;
}

export function Badge({ count, max = 999, className }: BadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        // 리스트 뱃지 — 16px(네비 뱃지와 동일 규격), caption semibold.
        // leading-none/tracking-normal: 토큰의 행간·자간이 중앙 정렬을 흐트러뜨려 제거.
        // pb-[2px]: 실측 기준 Pretendard 디센트 보정(잉크가 0.5px 아래 그려짐 → 1px 리프트).
        // 가로는 대칭 px-1 — 숫자별 잉크 폭 차이로 ±0.5px 반올림은 불가피(하드웨어 한계).
        // 숫자는 시스템 폰트 — Pretendard는 10~11px에서 힌팅이 약해 흐릿함. 시스템 폰트 숫자가 소형 크기에서 또렷 (2026-08-20)
        'flex h-4 min-w-4 items-center justify-center rounded-full bg-state-error px-1 pb-[1px] text-[11px] font-bold leading-none antialiased text-on-primary [font-family:-apple-system,system-ui,sans-serif]',
        className,
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
