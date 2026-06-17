'use client';

import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { IconChevronLeft } from '@/shared/ui/icons';
import { Toggle } from '@/shared/ui/Toggle';
import {
  useGetPushSettings,
  useToggleChatPush,
  useToggleInvitePush,
} from '@/features/notification-settings/queries';
import { useUIStore } from '@/store';

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
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 border-b border-divider px-4 py-3">
        <button onClick={() => router.push('/settings')} className="text-text-tertiary hover:text-text-secondary">
          <IconChevronLeft size={20} />
        </button>
        <h2 className="text-heading-md font-bold text-text-primary">알림 설정</h2>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <section className="py-2">
          <h3 className="px-4 py-2 text-sub-sm font-semibold uppercase text-text-tertiary">푸시 알림</h3>

          <SettingToggleRow
            title="채팅 알림"
            description="새 메시지 푸시 알림을 받습니다. 끄면 이 기기의 알림도 표시되지 않습니다."
            checked={chatEnabled}
            disabled={disabled}
            onChange={next => toggleChat.mutate(next, { onError })}
          />
          <SettingToggleRow
            title="초대 알림"
            description="채팅방 초대 푸시 알림을 받습니다."
            checked={inviteEnabled}
            disabled={disabled}
            onChange={next => toggleInvite.mutate(next, { onError })}
          />
        </section>
      </div>
    </main>
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
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1">
        <span className="text-sub text-text-primary">{title}</span>
        <p className="mt-0.5 text-sub-sm text-text-tertiary">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} ariaLabel={title} />
    </div>
  );
}
