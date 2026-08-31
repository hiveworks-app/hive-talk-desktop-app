'use client';

import { useCallback, useRef, useState } from 'react';
import { usePresignedUrl } from '@/features/storage/usePresignedUrl';
import { cn } from '@/shared/lib/cn';
import { IconPlay } from '@/shared/ui/icons';
import { formatMediaDuration } from '@/shared/utils/formatTimeUtils';

// RN chatImageGridMetrics 패리티 — 셀 간격 4px, 미리보기 최대 30장
const GAP_PX = 4;
const MAX_PREVIEW = 30;

interface RowDef {
  length: number;
  columns: number;
}

function buildRows(count: number): RowDef[] {
  if (count === 1) return [{ length: 1, columns: 1 }];
  if (count === 2) return [{ length: 2, columns: 2 }];
  // RN 패리티 — 3장은 한 줄 3칸 정사각
  if (count === 3) return [{ length: 3, columns: 3 }];
  if (count === 4) return [
    { length: 2, columns: 2 },
    { length: 2, columns: 2 },
  ];

  const fullRowsOf3 = Math.floor(count / 3);
  const remainder = count % 3;

  if (remainder === 0) {
    return Array(fullRowsOf3).fill({ length: 3, columns: 3 });
  }

  if (remainder === 2) {
    return [
      ...Array(fullRowsOf3).fill({ length: 3, columns: 3 }),
      { length: 2, columns: 2 },
    ];
  }

  // remainder === 1, count > 4 → avoid single item on last row
  if (remainder === 1 && count > 4) {
    const fullRowsUse = fullRowsOf3 - 1;
    return [
      ...Array(fullRowsUse).fill({ length: 3, columns: 3 }),
      { length: 2, columns: 2 },
      { length: 2, columns: 2 },
    ];
  }

  return [{ length: count, columns: 3 }];
}

interface ImageSource {
  key: string;
  src: string;
  storageKey?: string;
  isVideo?: boolean;
  duration?: number;
}

interface ChatImageGridProps {
  sources: ImageSource[];
  dimmed?: boolean;
  /** Max grid width in px (default: 240) */
  maxWidth?: number;
  onImageClick?: (index: number) => void;
}

export function ChatImageGrid({
  sources,
  dimmed,
  maxWidth = 240,
  onImageClick,
}: ChatImageGridProps) {
  // RN 패리티 — 30장 초과는 미리보기에서 잘라낸다
  const visibleSources = sources.slice(0, MAX_PREVIEW);
  const count = visibleSources.length;
  if (count === 0) return null;

  const rows = buildRows(count);

  // 렌더 중 변수 변이 방지: 각 row의 시작 인덱스를 미리 계산
  const rowStartIndices = rows.reduce<number[]>((acc, row, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + rows[i - 1].length);
    return acc;
  }, []);

  // 좁은 창(메인 최소 440·팝업 400) 대응 — 62cqw 상한으로 버블 컨테이너 폭에 비례 축소.
  // RN의 BUBBLE_OTHER_MAX_W(화면폭 62%) 번역. 컨테이너가 충분히 넓으면 기존 px 그대로.
  // (cqw는 메시지 행의 @container 기준 — 현재 유일한 사용처인 MessageContent가 보장)
  const widthCap = `min(${maxWidth}px, 62cqw)`;

  // Single image → larger, not square-cropped
  if (count === 1) {
    const src = visibleSources[0];
    return (
      <button
        type="button"
        onClick={() => onImageClick?.(0)}
        className={cn("min-w-0 max-w-full overflow-hidden rounded-2xl", dimmed && "opacity-50")}
        style={{ maxWidth: widthCap }}
      >
        <div className="relative">
          <GridImg
            storageKey={src.storageKey}
            fallbackSrc={src.src}
            className="max-h-48 max-w-full rounded-2xl object-cover"
          />
          {src.isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white">
                <IconPlay size={20} />
              </div>
            </div>
          )}
          {src.isVideo && <DurationBadge seconds={src.duration} />}
        </div>
      </button>
    );
  }

  return (
    // 셀은 px 계산 대신 flex 균등분할 + aspect-square — 컨테이너가 줄면 셀도 비율대로 축소
    // (RN createGridMetrics(containerWidth)와 동일 결과를 CSS로)
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg" style={{ width: widthCap }}>
      {rows.map((row, rowIndex) => {
        const start = rowStartIndices[rowIndex];
        const rowItems = visibleSources.slice(start, start + row.length);

        return (
          <div
            key={rowIndex}
            className="flex gap-1"
            style={{ marginTop: rowIndex === 0 ? 0 : GAP_PX }}
          >
            {rowItems.map((item, colIndex) => {
              const globalIndex = start + colIndex;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onImageClick?.(globalIndex)}
                  className={cn(
                    'aspect-square min-w-0 flex-1 overflow-hidden',
                    dimmed && 'opacity-50',
                  )}
                >
                  <div className="relative h-full w-full">
                    <GridImg
                      storageKey={item.storageKey}
                      fallbackSrc={item.src}
                      className="h-full w-full object-cover"
                    />
                    {item.isVideo && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white">
                          <IconPlay size={14} />
                        </div>
                      </div>
                    )}
                    {item.isVideo && <DurationBadge seconds={item.duration} />}
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ─── DurationBadge: 동영상 길이(M:SS) 우하단 배지 ─── */

function DurationBadge({ seconds }: { seconds?: number }) {
  const label = formatMediaDuration(seconds);
  if (!label) return null;
  return (
    <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
      {label}
    </span>
  );
}

/* ─── GridImg: presigned URL 자동 갱신 이미지 ─── */

function GridImg({
  storageKey,
  fallbackSrc,
  className,
}: {
  storageKey?: string;
  fallbackSrc: string;
  className?: string;
}) {
  const { data: freshUrl, refetch } = usePresignedUrl(storageKey);
  const [isBroken, setIsBroken] = useState(false);
  const retryCountRef = useRef(0);

  const src = freshUrl || fallbackSrc;

  const handleError = useCallback(() => {
    if (storageKey && retryCountRef.current < 2) {
      retryCountRef.current += 1;
      refetch();
    } else {
      setIsBroken(true);
    }
  }, [storageKey, refetch]);

  if (isBroken) {
    return <div className={cn('bg-gray-100', className)} />;
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={handleError}
    />
  );
}
