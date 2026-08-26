'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { IconChevronLeft, IconChevronRight } from '@/shared/ui/icons';

interface CalendarPopoverProps {
  open: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  /** 이 날짜 이전은 비활성 (방 생성일 등). 없으면 제한 없음 */
  minDate?: Date | null;
  /** 대화가 있는 날짜(YYYY-MM-DD)만 선택 가능 — RN activeDates 패리티. null이면 게이팅 없음(조회 실패 폴백) */
  activeDates?: Set<string> | null;
  /** 직전에 점프한 날짜 — 재오픈 시 하이라이트 (RN selectedDateKey 복원 패리티) */
  selectedDate?: Date | null;
}

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const stripTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * 채팅방 날짜 검색 달력 (RN CalendarBottomSheet 대응 — 데스크톱은 검색바 팝오버).
 * 월 그리드에서 날짜를 선택하면 해당 날짜 첫 메시지로 점프한다. 미래 날짜는 비활성.
 */
export function CalendarPopover({ open, onClose, onSelectDate, minDate, activeDates, selectedDate }: CalendarPopoverProps) {
  const today = stripTime(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const rootRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, onClose]);

  if (!open) return null;

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const minDay = minDate ? stripTime(minDate) : null;

  const goPrevMonth = () => {
    const prev = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(prev.getFullYear());
    setViewMonth(prev.getMonth());
  };
  const goNextMonth = () => {
    const next = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };
  // 이번 달 이후로는 이동 불필요 (미래 메시지 없음)
  const canGoNext = viewYear < today.getFullYear() || (viewYear === today.getFullYear() && viewMonth < today.getMonth());
  // 과거 하한 — 첫 대화(또는 방 생성) 달 이전으론 이동 불가 (RN minYear/maxYear 경계 패리티)
  const earliestKey = activeDates && activeDates.size > 0 ? [...activeDates].sort()[0] : null;
  const minBound = minDay ?? (earliestKey ? stripTime(new Date(earliestKey)) : null);
  const canGoPrev =
    !minBound ||
    viewYear > minBound.getFullYear() ||
    (viewYear === minBound.getFullYear() && viewMonth > minBound.getMonth());

  const cells: Array<Date | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ];

  return (
    <div
      ref={rootRef}
      className="absolute left-0 top-full z-30 mt-1 w-[264px] rounded-xl border border-divider bg-white p-3 shadow-[0px_2px_15px_rgba(0,0,0,0.15)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          disabled={!canGoPrev}
          className="flex h-7 w-7 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60 disabled:opacity-30"
          aria-label="이전 달"
        >
          <IconChevronLeft />
        </button>
        {/* 연/월 빠른 이동 (RN WheelPicker 대응 — 데스크톱은 네이티브 셀렉트).
            1년 전 대화로 12번 클릭하던 문제 해소, 범위는 첫 대화~이번 달로 제한 */}
        <span className="flex items-center gap-0.5 text-sub font-bold text-text-primary">
          <select
            value={viewYear}
            onChange={e => {
              const y = Number(e.target.value);
              // 연 변경 시 월을 경계 안으로 클램프
              let m = viewMonth;
              if (minBound && y === minBound.getFullYear() && m < minBound.getMonth()) m = minBound.getMonth();
              if (y === today.getFullYear() && m > today.getMonth()) m = today.getMonth();
              setViewYear(y);
              setViewMonth(m);
            }}
            className="cursor-pointer appearance-none rounded bg-transparent py-0.5 pl-1 pr-0.5 text-sub font-bold text-text-primary outline-none hover:bg-gray-100"
            aria-label="연도 선택"
          >
            {Array.from(
              { length: today.getFullYear() - (minBound?.getFullYear() ?? today.getFullYear()) + 1 },
              (_, i) => (minBound?.getFullYear() ?? today.getFullYear()) + i,
            ).map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select
            value={viewMonth}
            onChange={e => setViewMonth(Number(e.target.value))}
            className="cursor-pointer appearance-none rounded bg-transparent py-0.5 pl-1 pr-0.5 text-sub font-bold text-text-primary outline-none hover:bg-gray-100"
            aria-label="월 선택"
          >
            {Array.from({ length: 12 }, (_, m) => m)
              .filter(m => {
                if (minBound && viewYear === minBound.getFullYear() && m < minBound.getMonth()) return false;
                if (viewYear === today.getFullYear() && m > today.getMonth()) return false;
                return true;
              })
              .map(m => (
                <option key={m} value={m}>{m + 1}월</option>
              ))}
          </select>
        </span>
        <button
          type="button"
          onClick={goNextMonth}
          disabled={!canGoNext}
          className="flex h-7 w-7 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60 disabled:opacity-30"
          aria-label="다음 달"
        >
          <IconChevronRight />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAYS.map(day => (
          <span key={day} className="py-1 text-sub-sm text-text-tertiary">
            {day}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`empty-${i}`} />;
          const isFuture = date.getTime() > today.getTime();
          const isBeforeMin = minDay ? date.getTime() < minDay.getTime() : false;
          // RN 패리티 — activeDates가 있으면 대화 있는 날짜만 활성
          const isInactive = activeDates ? !activeDates.has(toDateKey(date)) : false;
          const disabled = isFuture || isBeforeMin || isInactive;
          const isToday = date.getTime() === today.getTime();
          const isSelected = !!selectedDate && toDateKey(date) === toDateKey(selectedDate);
          return (
            <button
              key={date.getTime()}
              type="button"
              disabled={disabled}
              onClick={() => {
                onSelectDate(date);
                onClose();
              }}
              className={cn(
                'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sub transition-colors',
                disabled
                  ? 'text-text-tertiary/40'
                  : 'text-text-primary hover:bg-gray-100',
                isToday && !disabled && 'bg-[#E6F3FF] font-semibold text-primary',
                // 직전 점프 날짜 강조 — today보다 우선 (RN selectedDateKey 패리티)
                isSelected && !disabled && 'bg-primary font-semibold text-white hover:bg-primary',
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
