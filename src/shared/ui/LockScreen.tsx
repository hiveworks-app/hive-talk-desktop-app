'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiLogin } from '@/features/auth/api';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { ProfileCircle } from '@/shared/ui/ProfileCircle';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  const masked = '*'.repeat(Math.max(local.length - 2, 0));
  return `${visible}${masked}@${domain}`;
}

export function LockScreen() {
  const isLocked = useUIStore(s => s.isLocked);
  const unlock = useUIStore(s => s.unlock);
  const user = useAuthStore(s => s.user);
  const deviceInfo = useAuthStore(s => s.deviceInfo);
  const setAuth = useAuthStore(s => s.setAuth);
  const logout = useAuthStore(s => s.logout);
  const router = useRouter();
  useDimmed(isLocked);

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isLocked) return null;

  const handleUnlock = async () => {
    if (!password.trim() || !user?.email || !deviceInfo) return;

    setIsVerifying(true);
    setError('');

    try {
      const res = await apiLogin({
        email: user.email,
        password: password.trim(),
        deviceToken: deviceInfo.deviceId,
        deviceType: 'DESKTOP',
        deviceId: deviceInfo.deviceId,
      });

      const { accessToken, refreshToken } = res.payload;
      setAuth({ accessToken, refreshToken });
      setPassword('');
      unlock();
    } catch {
      setError('비밀번호가 올바르지 않습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isVerifying) {
      handleUnlock();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-lg">
      <div className="flex w-full max-w-[320px] flex-col items-center px-4">
        {/* 프로필 */}
        <ProfileCircle
          name={user?.name ?? ''}
          size="lg"
          storageKey={user?.thumbnailProfileUrl ?? user?.profileImageUrl}
          className="!h-20 !w-20"
        />

        {/* 이름 */}
        <p className="mt-3 text-heading-sm font-semibold text-text-primary">
          {user?.name ?? ''}
        </p>

        {/* 마스킹된 이메일 */}
        <p className="mt-1 text-sub-sm text-text-tertiary">
          {user?.email ? maskEmail(user.email) : ''}
        </p>

        {/* 잠금 배지 */}
        <div className="mt-4 flex items-center gap-2 rounded-full bg-gray-100 px-4 py-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-sub-sm font-medium text-text-secondary">잠금 모드</span>
        </div>

        {/* 비밀번호 입력 */}
        <div className="mt-6 w-full space-y-3" onKeyDown={handleKeyDown}>
          <Input
            type="password"
            value={password}
            onChange={e => {
              setPassword(e.target.value);
              setError('');
            }}
            placeholder="비밀번호"
            autoFocus
            disabled={isVerifying}
            error={!!error}
            className="h-11"
          />
          {error && (
            <p className="text-sub-sm text-state-error">{error}</p>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={handleUnlock}
            disabled={!password.trim() || isVerifying}
            fullWidth
          >
            {isVerifying ? '확인 중...' : '잠금 해제'}
          </Button>
        </div>

        {/* 다른 계정 로그인 */}
        <button
          type="button"
          onClick={() => {
            logout();
            router.replace('/login');
          }}
          className="mt-6 cursor-pointer text-sub text-text-tertiary underline hover:text-text-secondary"
        >
          다른 계정으로 로그인
        </button>
      </div>
    </div>
  );
}
