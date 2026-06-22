'use client';

interface StartConversationEmptyStateProps {
  message?: string;
}

/**
 * 채팅방 진입 시 '대화 시작 전' 초기화면 (메시지가 하나도 없을 때).
 * chat-bg 위에 반투명 흰 카드 + 꿀벌 일러스트 + 2줄 안내.
 * RN StartConversationEmptyState / Figma 1039-20959 패리티.
 */
export function StartConversationEmptyState({
  message = '메세지 입력을 눌러\n대화를 시작하세요!',
}: StartConversationEmptyStateProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-chat-bg px-2.5">
      <div className="flex h-[205px] w-[242px] flex-col items-center justify-center gap-2.5 rounded-[10px] bg-white/70 py-5">
        <img
          src="/new-message.png"
          alt="대화 시작"
          className="h-[111px] w-[146px] object-contain"
        />
        <p className="whitespace-pre-line text-center text-sub-sm text-gray-900">{message}</p>
      </div>
    </div>
  );
}
