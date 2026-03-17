'use client';

import { memo } from 'react';

const SKELETON_ROWS = [
  { isMe: false, hasAvatar: true, nameWidth: 48, bubbleWidth: 180 },
  { isMe: false, hasAvatar: false, nameWidth: 0, bubbleWidth: 140 },
  { isMe: true, hasAvatar: false, nameWidth: 0, bubbleWidth: 160 },
  { isMe: false, hasAvatar: true, nameWidth: 56, bubbleWidth: 200 },
  { isMe: true, hasAvatar: false, nameWidth: 0, bubbleWidth: 120 },
  { isMe: false, hasAvatar: false, nameWidth: 0, bubbleWidth: 170 },
  { isMe: true, hasAvatar: false, nameWidth: 0, bubbleWidth: 190 },
  { isMe: false, hasAvatar: true, nameWidth: 40, bubbleWidth: 150 },
] as const;

function MessageSkeletonComponent() {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      <div className="flex flex-col gap-3 px-4 py-4">
        {SKELETON_ROWS.map((row, i) => (
          <div
            key={i}
            className={`flex items-end gap-2 ${row.isMe ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {!row.isMe && row.hasAvatar && (
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                  style={{ animation: `shimmer 1.5s infinite` }}
                />
              </div>
            )}
            {!row.isMe && !row.hasAvatar && <div className="w-9 shrink-0" />}
            <div className={`flex flex-col ${row.isMe ? 'items-end' : 'items-start'}`}>
              {row.nameWidth > 0 && (
                <div
                  className="relative mb-1 h-3 overflow-hidden rounded bg-gray-200"
                  style={{ width: row.nameWidth }}
                >
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                    style={{ animation: `shimmer 1.5s infinite` }}
                  />
                </div>
              )}
              <div
                className="relative h-9 overflow-hidden rounded-xl bg-gray-200"
                style={{ width: row.bubbleWidth }}
              >
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                  style={{ animation: `shimmer 1.5s infinite` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export const MessageSkeleton = memo(MessageSkeletonComponent);
