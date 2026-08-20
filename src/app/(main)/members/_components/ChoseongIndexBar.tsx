'use client';

import { useMemo } from 'react';
import { cn } from '@/shared/lib/cn';
import { getIndexLabel } from '@/shared/utils/hangeulSearch';
import IconStarFilled from '@assets/icons/star-filled.svg';

/**
 * 정책 정본(member.md §인덱스 룰러)의 17개 고정 슬롯 (RN FIXED_RULER_SLOTS 패리티).
 * 멤버 명단 유무와 무관하게 항상 동일하게 렌더링되며, dataIndex로 활성/비활성을 표현한다.
 */
const FIXED_RULER_SLOTS = [
  { kind: 'star' as const },
  { kind: 'dot' as const, labels: ['ㄱ', 'ㄴ'] },
  { kind: 'label' as const, label: 'ㄷ' },
  { kind: 'dot' as const, labels: ['ㄹ', 'ㅁ'] },
  { kind: 'label' as const, label: 'ㅂ' },
  { kind: 'dot' as const, labels: ['ㅅ', 'ㅇ'] },
  { kind: 'label' as const, label: 'ㅈ' },
  { kind: 'dot' as const, labels: ['ㅊ', 'ㅋ', 'ㅌ', 'ㅍ'] },
  { kind: 'label' as const, label: 'ㅎ' },
  { kind: 'dot' as const, labels: ['A', 'B'] },
  { kind: 'label' as const, label: 'C' },
  { kind: 'dot' as const, labels: ['D', 'E', 'F', 'G', 'H', 'I'] },
  { kind: 'label' as const, label: 'J' },
  { kind: 'dot' as const, labels: ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'] },
  { kind: 'label' as const, label: 'S' },
  { kind: 'dot' as const, labels: ['T', 'U', 'V', 'W', 'X', 'Y', 'Z'] },
  { kind: 'label' as const, label: '#' },
] as const;

interface ChoseongIndexBarProps {
  /** 정책 정렬(한글→영문→숫자→특수)된 멤버 이름 목록 — 슬롯별 첫 인덱스 계산용 */
  names: string[];
  /** 슬롯 클릭 → 해당 그룹 첫 멤버 인덱스로 점프 */
  onJump: (memberIndex: number) => void;
  /** ★ 슬롯 클릭 → 목록 최상단(관심멤버 섹션) */
  onJumpToTop: () => void;
}

/**
 * 멤버목록 우측 초성/알파벳 인덱스 룰러 (RN ChoseongIndexBar 대응 — 데스크톱은 클릭 점프).
 * 30명 이상일 때만 노출하는 판단은 호출부 책임.
 */
export function ChoseongIndexBar({ names, onJump, onJumpToTop }: ChoseongIndexBarProps) {
  const firstSeenByLabel = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if (!name) continue;
      const label = getIndexLabel(name[0]);
      if (!map.has(label)) map.set(label, i);
    }
    return map;
  }, [names]);

  return (
    <div className="absolute bottom-2 right-0.5 top-2 z-10 flex w-5 flex-col items-center justify-center gap-0.5">
      {FIXED_RULER_SLOTS.map((slot, slotIdx) => {
        if (slot.kind === 'star') {
          return (
            <button
              key="star"
              type="button"
              onClick={onJumpToTop}
              aria-label="목록 맨 위로"
              className="flex h-4 w-5 items-center justify-center"
            >
              <IconStarFilled width={11} height={11} className="text-gray-700" />
            </button>
          );
        }
        if (slot.kind === 'label') {
          const dataIndex = firstSeenByLabel.get(slot.label);
          const active = dataIndex !== undefined;
          return (
            <button
              key={slot.label}
              type="button"
              disabled={!active}
              onClick={() => active && onJump(dataIndex)}
              className={cn(
                'flex h-4 w-5 items-center justify-center text-[11px] leading-none',
                active ? 'text-gray-700 hover:font-bold' : 'text-gray-400',
              )}
            >
              {slot.label}
            </button>
          );
        }
        // dot 그룹 — 그룹 내 첫 등장 라벨의 인덱스로 점프
        let groupFirst: number | undefined;
        for (const lbl of slot.labels) {
          const idx = firstSeenByLabel.get(lbl);
          if (idx !== undefined && (groupFirst === undefined || idx < groupFirst)) groupFirst = idx;
        }
        const active = groupFirst !== undefined;
        return (
          <button
            key={`dot-${slotIdx}`}
            type="button"
            disabled={!active}
            onClick={() => active && groupFirst !== undefined && onJump(groupFirst)}
            aria-label={slot.labels.join(', ')}
            className="flex h-2.5 w-5 items-center justify-center"
          >
            <span className={cn('h-[5px] w-[5px] rounded-full', active ? 'bg-gray-700' : 'bg-gray-400')} />
          </button>
        );
      })}
    </div>
  );
}
