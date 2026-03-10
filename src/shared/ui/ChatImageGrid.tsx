'use client';

import { cn } from '@/shared/lib/cn';

const GAP_PX = 4;

interface RowDef {
  length: number;
  columns: number;
}

function buildRows(count: number): RowDef[] {
  if (count === 1) return [{ length: 1, columns: 1 }];
  if (count === 2) return [{ length: 2, columns: 2 }];
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
  isVideo?: boolean;
}

interface ChatImageGridProps {
  sources: ImageSource[];
  dimmed?: boolean;
  /** Max grid width in px (default: 288 = max-w-72) */
  maxWidth?: number;
  onImageClick?: (index: number) => void;
}

export function ChatImageGrid({
  sources,
  dimmed,
  maxWidth = 288,
  onImageClick,
}: ChatImageGridProps) {
  const count = sources.length;
  if (count === 0) return null;

  const rows = buildRows(count);

  // 렌더 중 변수 변이 방지: 각 row의 시작 인덱스를 미리 계산
  const rowStartIndices = rows.reduce<number[]>((acc, row, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + rows[i - 1].length);
    return acc;
  }, []);

  const cellSize = (columns: number) =>
    (maxWidth - GAP_PX * (columns - 1)) / columns;

  // Single image → larger, not square-cropped
  if (count === 1) {
    const src = sources[0];
    return (
      <button
        type="button"
        onClick={() => onImageClick?.(0)}
        className={cn('overflow-hidden rounded-lg', dimmed && 'opacity-50')}
        style={{ maxWidth }}
      >
        <div className="relative">
          <img src={src.src} alt="" loading="lazy" className="max-h-48 max-w-full rounded-lg object-cover" />
          {src.isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </button>
    );
  }

  return (
    <div style={{ maxWidth }}>
      {rows.map((row, rowIndex) => {
        const start = rowStartIndices[rowIndex];
        const rowItems = sources.slice(start, start + row.length);
        const size = cellSize(row.columns);

        return (
          <div
            key={rowIndex}
            className="flex"
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
                    'overflow-hidden rounded-lg',
                    dimmed && 'opacity-50',
                  )}
                  style={{
                    width: size,
                    height: size,
                    marginRight: colIndex < row.columns - 1 ? GAP_PX : 0,
                  }}
                >
                  <div className="relative h-full w-full">
                    <img
                      src={item.src}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {item.isVideo && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                            <polygon points="5,3 19,12 5,21" />
                          </svg>
                        </div>
                      </div>
                    )}
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
