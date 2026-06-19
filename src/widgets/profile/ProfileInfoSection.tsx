'use client';

import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import IconExternalSymbol from '@assets/icons/external-symbol.svg';

interface ProfileInfoSectionProps {
  name: string;
  email?: string | null;
  storageKey?: string | null;
  /** 회사명·부서·직책 등 부가 정보 라인 (falsy/공백 값은 자동 제외) */
  lines?: Array<string | null | undefined>;
  /** 협력멤버(외부) — 아바타 우하단에 ∞ 배지 노출 */
  isExternal?: boolean;
  /** 내 프로필 — 이름 앞 '나' 배지 노출 */
  showMeBadge?: boolean;
}

/**
 * 프로필 본문 공용 영역 (아바타 → 이름 → 이메일 → 부가 정보).
 * 모달별 차이(나/∞ 배지, 라인 구성)는 props로만 주입한다.
 */
export function ProfileInfoSection({
  name,
  email,
  storageKey,
  lines,
  isExternal = false,
  showMeBadge = false,
}: ProfileInfoSectionProps) {
  const infoLines = (lines ?? []).filter((l): l is string => !!l && l.trim().length > 0);

  return (
    <div className="flex flex-col items-center">
      {/* 아바타 (+협력멤버 ∞ 배지) */}
      <div className="relative">
        <ProfileCircle name={name} storageKey={storageKey} className="h-[120px] w-[120px]" />
        {isExternal && (
          <span className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0px_2px_11px_rgba(0,0,0,0.12)]">
            <IconExternalSymbol width={22} height={12} className="text-text-tertiary" />
          </span>
        )}
      </div>

      {/* 이름 / 이메일 / 부가 정보 */}
      <div className="mt-[30px] flex w-full flex-col items-center gap-3">
        <div className="flex items-center gap-0.5">
          {showMeBadge && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-300 text-[12px] font-semibold leading-none text-text-primary">
              나
            </span>
          )}
          <span className="text-[16px] font-semibold leading-[22px] tracking-[-0.32px] text-text-primary">
            {name}
          </span>
        </div>

        <div className="flex w-full flex-col items-center gap-1.5 text-center">
          {email && (
            <p className="w-full break-all text-[16px] leading-[22px] tracking-[-0.16px] text-text-primary">
              {email}
            </p>
          )}
          {infoLines.length > 0 && (
            <div className="flex w-full flex-col gap-0.5 text-[15px] leading-[22px] tracking-[-0.15px] text-text-secondary">
              {infoLines.map((line, i) => (
                <p key={i} className="w-full break-words">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
