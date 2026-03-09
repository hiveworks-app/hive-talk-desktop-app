'use client';

import { useState } from 'react';
import Image from 'next/image';
import { apiLogin } from '@/features/auth/api';
import { useAuthStore } from '@/store/auth/authStore';
import { useUIStore } from '@/store';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';

export function LockScreen() {
  const isLocked = useUIStore(s => s.isLocked);
  const unlock = useUIStore(s => s.unlock);
  const user = useAuthStore(s => s.user);
  const deviceInfo = useAuthStore(s => s.deviceInfo);
  const setAuth = useAuthStore(s => s.setAuth);

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
        deviceToken: 'web-no-fcm',
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
        <Image
          src="/hivetalk-login-logo.png"
          alt="HiveTalk"
          width={160}
          height={92}
          priority
        />

        <div className="mt-2 flex items-center gap-2 rounded-full bg-gray-100 px-4 py-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-sub-sm font-medium text-text-secondary">잠금 모드</span>
        </div>

        <p className="mt-6 text-sub text-text-secondary">
          비밀번호를 입력하여 잠금을 해제하세요
        </p>

        <div className="mt-4 w-full space-y-3" onKeyDown={handleKeyDown}>
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
      </div>
    </div>
  );
}
