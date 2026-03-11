'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { WebSocketChannelTypes } from '@/shared/types/websocket';
import { ParticipantsTab } from './ParticipantsTab';
import { MediaTab } from './MediaTab';
import { FilesTab } from './FilesTab';

type SidePanelTab = 'participants' | 'media' | 'files';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  channelType: WebSocketChannelTypes;
  lastMessageId: string;
}

export function SidePanel({ isOpen, onClose, roomId, channelType, lastMessageId }: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<SidePanelTab>('participants');

  return (
    <>
      {/* 모바일 오버레이 배경 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          'shrink-0 border-l border-divider bg-background transition-all duration-200',
          isOpen
            ? 'fixed inset-y-0 right-0 z-40 w-[300px] md:relative md:z-auto md:w-[320px]'
            : 'w-0 overflow-hidden border-l-0',
        )}
      >
        {isOpen && (
          <div className="flex h-full flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-divider px-4 py-3">
            <h3 className="text-sub font-bold text-text-primary">채팅방 정보</h3>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded text-text-tertiary hover:bg-gray-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 탭 */}
          <div className="flex border-b border-divider">
            {(['participants', 'media', 'files'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-2 text-sub-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-text-tertiary hover:text-text-secondary',
                )}
              >
                {tab === 'participants' ? '참여자' : tab === 'media' ? '사진/동영상' : '파일'}
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            {activeTab === 'participants' && (
              <ParticipantsTab roomId={roomId} channelType={channelType} />
            )}
            {activeTab === 'media' && (
              <MediaTab roomId={roomId} channelType={channelType} lastMessageId={lastMessageId} />
            )}
            {activeTab === 'files' && (
              <FilesTab roomId={roomId} channelType={channelType} lastMessageId={lastMessageId} />
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
