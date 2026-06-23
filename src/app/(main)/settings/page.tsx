'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import IconAccount from '@assets/icons/setting-account.svg';
import IconAppv from '@assets/icons/setting-appv.svg';
import IconBell from '@assets/icons/setting-bell.svg';
import IconLogout from '@assets/icons/setting-logout.svg';
import IconSecurity from '@assets/icons/setting-security.svg';
import IconSync from '@assets/icons/setting-sync.svg';
import { MEMBERS_KEY } from '@/shared/config/queryKeys';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { formatSyncedAt } from '@/shared/utils/formatTimeUtils';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';
import { MyProfileDialog } from '@/widgets/profile/MyProfileDialog';

export default function SettingsPage() {
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const { showSnackbar } = useUIStore();
  const user = useAuthStore(s => s.user);
  const [showProfile, setShowProfile] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  // 마지막 동기화 시각 = MEMBERS_KEY 쿼리의 마지막 성공 fetch 시각(별도 저장 불필요)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(
    () => queryClient.getQueryState(MEMBERS_KEY)?.dataUpdatedAt ?? null,
  );

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { getAppVersion: () => Promise<string> } })
      .electronAPI;
    if (api?.getAppVersion) {
      api.getAppVersion().then(setAppVersion);
    }
  }, []);

  const handleLogout = () => {
    useAuthStore.getState().logout();
    router.replace('/login');
  };

  const handleSyncMembers = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
      await queryClient.refetchQueries({ queryKey: MEMBERS_KEY });
      setLastSyncedAt(Date.now());
      showSnackbar({ message: '멤버 목록을 동기화했습니다.', state: 'success' });
    } catch {
      showSnackbar({ message: '동기화에 실패했습니다.', state: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  // 부서 · 직급 (organization 우선, RN 패리티). 둘 다 없으면 소속 회사명 fallback.
  const department = user?.organization?.departmentName ?? user?.department ?? '';
  const job = user?.job ?? '';
  const subtitle = [department, job].filter(Boolean).join(' · ') || (user?.companyName ?? '');
  const versionText = appVersion ?? process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      {/* 회색(gray-50) 상단 영역 — 헤더 구분선 제거, 아래 둥근 패널이 분리 (Figma 2382-53597) */}
      <header className="flex h-14 shrink-0 items-center px-4">
        <h2 className="text-heading-lg font-semibold text-text-primary">전체설정</h2>
      </header>

      {/* 콘텐츠 패널: 둥근 흰 영역 (멤버목록·채팅 패턴) */}
      <div className="scrollbar-thin flex-1 overflow-y-auto rounded-t-2xl bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
        {/* 프로필 카드 */}
        <div className="flex items-center gap-3.5 px-4 py-3.5">
          <ProfileCircle name={user?.name ?? ''} size="lg" storageKey={user?.profileUrl} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body font-semibold text-text-primary">
              {user?.name ?? ''}
            </span>
            {subtitle && (
              <span className="truncate text-sub-sm text-text-secondary">{subtitle}</span>
            )}
          </div>
          <button
            onClick={() => setShowProfile(true)}
            className="shrink-0 rounded-full border border-outline bg-surface px-2.5 py-1.5 text-sub-sm text-text-primary transition-colors hover:bg-surface-pressed"
          >
            프로필 관리
          </button>
        </div>

        {/* 메뉴 리스트 (섹션 구분 없는 플랫 리스트, Figma 2382:53597) */}
        <SettingRow
          icon={<IconAccount className="h-5 w-5" />}
          title="하이브톡 계정정보"
          onClick={() => router.push('/settings/account')}
        />
        <SettingRow
          icon={<IconBell className="h-5 w-5" />}
          title="알림 설정"
          onClick={() => router.push('/settings/notifications')}
        />
        <SettingRow
          icon={<IconSync className="h-5 w-5" />}
          title={isSyncing ? '멤버 목록 동기화중...' : '멤버 목록 동기화'}
          right={lastSyncedAt ? formatSyncedAt(lastSyncedAt) : undefined}
          onClick={handleSyncMembers}
          disabled={isSyncing}
        />
        <SettingRow
          icon={<IconSecurity className="h-5 w-5" />}
          title="개인/보안"
          onClick={() => router.push('/settings/personal-security')}
        />
        <SettingRow icon={<IconAppv className="h-5 w-5" />} title="앱 버전" right={versionText} />
        <SettingRow
          icon={<IconLogout className="h-5 w-5" />}
          title="로그아웃"
          onClick={handleLogout}
        />
      </div>

      <MyProfileDialog isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </main>
  );
}

function SettingRow({
  icon,
  title,
  right,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  right?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-body font-medium text-text-primary">{title}</span>
      {right && <span className="shrink-0 text-sub text-text-secondary">{right}</span>}
    </>
  );

  // 앱 버전처럼 동작 없는 행은 비-인터랙티브 div로 렌더
  if (!onClick) {
    return <div className="flex w-full items-center gap-2.5 px-4 py-4">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 px-4 py-4 text-left transition-colors hover:bg-surface-pressed disabled:pointer-events-none"
    >
      {content}
    </button>
  );
}
