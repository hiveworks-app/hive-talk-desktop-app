'use client';

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
  const disabled = isLoading || toggleChat.isPending || toggleInvite.isPending;

  const onError = () => showSnackbar({ message: '알림 설정 변경에 실패했습니다.', state: 'error' });

  return (
    <SettingsOverlay bg="bg-background">
      <header className="relative flex h-[52px] shrink-0 items-center justify-center border-b border-divider px-4">
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
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <section className="py-2">
          <SettingToggleRow
            title="채팅 알림"
            description="새 메시지가 왔을 때 푸쉬알림을 받게 돼요."
            checked={chatEnabled}
            disabled={disabled}
            onChange={next => toggleChat.mutate(next, { onError })}
          />
          <SettingToggleRow
            title="초대 알림"
            description="멤버초대에 대한 푸쉬알림을 받게 돼요."
            checked={inviteEnabled}
            disabled={disabled}
            onChange={next => toggleInvite.mutate(next, { onError })}
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
