'use client';

import { useEffect, useState } from 'react';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { useQueryClient } from '@tanstack/react-query';
import { MEMBERS_KEY } from '@/shared/config/queryKeys';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store';
import { MyProfileDialog } from '@/widgets/profile/MyProfileDialog';
import { SettingItem } from './_components/SettingItem';

export default function SettingsPage() {
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const { showSnackbar } = useUIStore();
  const [showProfile, setShowProfile] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { getAppVersion: () => Promise<string> } }).electronAPI;
    if (api?.getAppVersion) {
      api.getAppVersion().then(setAppVersion);
    }
  }, []);

  const handleLogout = () => {
    useAuthStore.getState().logout();
    router.replace('/login');
  };

  const handleSyncMembers = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
      await queryClient.refetchQueries({ queryKey: MEMBERS_KEY });
      showSnackbar({ message: '멤버 목록을 동기화했습니다.', state: 'success' });
    } catch {
      showSnackbar({ message: '동기화에 실패했습니다.', state: 'error' });
    }
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      <header className="border-b border-divider px-4 py-3">
        <h2 className="text-heading-md font-bold text-text-primary">설정</h2>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {/* 프로필 섹션 */}
        <section className="border-b border-divider py-2">
          <h3 className="px-4 py-2 text-sub-sm font-semibold uppercase text-text-tertiary">프로필</h3>
          <SettingItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
            title="내 프로필"
            description="프로필 정보를 확인하고 수정합니다"
            onClick={() => setShowProfile(true)}
          />
        </section>

        {/* 계정 섹션 */}
        <section className="border-b border-divider py-2">
          <h3 className="px-4 py-2 text-sub-sm font-semibold uppercase text-text-tertiary">계정</h3>
          <SettingItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
            title="비밀번호 변경"
            onClick={() => router.push('/settings/password')}
          />
        </section>

        {/* 데이터 섹션 */}
        <section className="border-b border-divider py-2">
          <h3 className="px-4 py-2 text-sub-sm font-semibold uppercase text-text-tertiary">데이터</h3>
          <SettingItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            }
            title="멤버 목록 동기화"
            description="서버에서 최신 멤버 목록을 다시 불러옵니다"
            onClick={handleSyncMembers}
          />
        </section>

        {/* 앱 정보 섹션 */}
        <section className="py-2">
          <h3 className="px-4 py-2 text-sub-sm font-semibold uppercase text-text-tertiary">앱 정보</h3>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sub text-text-primary">앱 버전</span>
            <span className="text-sub text-text-tertiary">
              {appVersion ? `v${appVersion}` : `v${process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'} (Web)`}
            </span>
          </div>
        </section>

        {/* 로그아웃 */}
        <div className="px-4 py-4">
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-red-200 py-3 text-sub font-medium text-red-500 transition-colors hover:bg-red-50"
          >
            로그아웃
          </button>
        </div>
      </div>

      <MyProfileDialog isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </main>
  );
}

