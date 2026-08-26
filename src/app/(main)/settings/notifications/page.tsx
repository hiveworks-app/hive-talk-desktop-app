'use client';

import { isApiError } from '@/shared/api';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import { Toggle } from '@/shared/ui/Toggle';
import {
  useGetPushSettings,
  useToggleChatPush,
  useToggleInvitePush,
} from '@/features/notification-settings/queries';
import { useUIStore } from '@/store';
import { SettingsOverlay } from '../_components/SettingsOverlay';

export default function NotificationSettingsPage() {
  const router = useAppRouter();
  const { showSnackbar } = useUIStore();
  const { data: settings, isLoading } = useGetPushSettings();
  const toggleChat = useToggleChatPush();
  const toggleInvite = useToggleInvitePush();

  const chatEnabled = settings?.allRoomsPushEnabled ?? true;
  const inviteEnabled = settings?.allInvitesPushEnabled ?? true;

  // 토글별 개별 disabled (RN 패리티) — 한쪽 저장 중에 다른 토글까지 잠기지 않게.
  // 문구도 토글별 + 서버 메시지 우선 (RN 패리티)
  const onChatError = (err: unknown) =>
    showSnackbar({
      message: (isApiError(err) && err.message) || '채팅 알림 설정 변경에 실패했어요.',
      state: 'error',
    });
  const onInviteError = (err: unknown) =>
    showSnackbar({
      message: (isApiError(err) && err.message) || '초대 알림 설정 변경에 실패했어요.',
      state: 'error',
    });

  return (
    <SettingsOverlay bg="bg-gray-50">
      <header className="relative flex h-[52px] shrink-0 items-center justify-center px-4">
        <h2 className="text-heading-md font-medium text-text-primary">알림 설정</h2>
        <button
          onClick={() => router.push('/settings')}
          className="electron-no-drag absolute right-3 flex h-8 w-8 items-center justify-center rounded text-text-primary transition-opacity hover:opacity-70 active:opacity-60"
          aria-label="닫기"
        >
          <IconCloseStroke width={20} height={20} />
        </button>
      </header>

      {/* RN NotificationSettingsScreen 패리티 — 섹션 헤더 없음, 카피 정본 */}
      <div className="scrollbar-thin flex-1 overflow-y-auto rounded-t-2xl bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
        <section className="py-2">
          <SettingToggleRow
            title="채팅 알림"
            description="새 메시지가 왔을 때 푸쉬알림을 받게 돼요."
            checked={chatEnabled}
            disabled={isLoading || toggleChat.isPending}
            onChange={next => toggleChat.mutate(next, { onError: onChatError })}
          />
          <SettingToggleRow
            title="초대 알림"
            description="멤버초대에 대한 푸쉬알림을 받게 돼요."
            checked={inviteEnabled}
            disabled={isLoading || toggleInvite.isPending}
            onChange={next => toggleInvite.mutate(next, { onError: onInviteError })}
          />
        </section>
      </div>
    </SettingsOverlay>
  );
}

function SettingToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    /* RN 패리티 — 제목 heading-sm(16) medium gray-800 + 설명 sub(14) gray-600 */
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1">
        <span className="text-heading-sm font-medium text-gray-800">{title}</span>
        <p className="mt-0.5 text-sub text-gray-600">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} ariaLabel={title} />
    </div>
  );
}
