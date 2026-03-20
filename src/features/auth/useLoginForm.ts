'use client';

import { useSyncExternalStore, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { del } from 'idb-keyval';
import { useLogin } from '@/features/auth/queries';
import {
  fetchDMRoomList,
  fetchGMRoomList,
  fetchEMRoomList,
} from '@/features/chat-room-list/queries';
import { apiGetMembersList } from '@/features/members/api';
import { apiGetStorage } from '@/features/storage/api';
import {
  DM_ROOM_LIST_KEY,
  GM_ROOM_LIST_KEY,
  EM_ROOM_LIST_KEY,
  MEMBERS_KEY,
  PRESIGNED_URL,
} from '@/shared/config/queryKeys';
import type { MemberItem } from '@/shared/types/user';
import { USER_TYPE } from '@/shared/types/user';
import type { UserType } from '@/shared/types/user';
import { getBrowserDeviceId } from '@/shared/utils/deviceId';
import { useAuthStore } from '@/store/auth/authStore';

function validateLoginInfo(email: string, password: string) {
  const _email = email.trim();
  const _password = password.trim();
  if (_email.length === 0) return '접속하실 계정의 아이디(이메일)를 입력하세요.';
  if (_password.length === 0) return '접속하실 계정의 비밀번호를 입력하세요.';
  if (!_email.includes('@')) return '아이디가 이메일 형식이 아닙니다.';
  return null;
}

export function useLoginForm() {
  const accessToken = useAuthStore(s => s.accessToken);
  const logout = useAuthStore(s => s.logout);
  const setAuth = useAuthStore(s => s.setAuth);
  const { mutateAsync: login } = useLogin();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const autoLoginStored = useSyncExternalStore(
    cb => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb); },
    () => localStorage.getItem('auto-login') === 'true',
    () => false,
  );
  const [autoLogin, setAutoLogin] = useState(autoLoginStored);

  const isFormFilled = email.trim().length > 0 && password.trim().length > 0;

  const onLogin = async () => {
    const errorMessage = validateLoginInfo(email, password);
    if (errorMessage) {
      setLoginError(errorMessage);
      return;
    }

    if (!navigator.onLine) {
      setLoginError('오프라인 상태에서는 로그인할 수 없습니다.');
      return;
    }

    setIsProcessing(true);
    try {
      const deviceId = getBrowserDeviceId();
      const params = {
        deviceToken: deviceId,
        deviceType: 'DESKTOP' as const,
        deviceId,
        email: email.trim(),
        password: password.trim(),
      };

      const res = await login(params);

      localStorage.setItem('auto-login', String(autoLogin));
      queryClient.clear();
      await del('hiveworks-query-cache');

      const { accessToken, refreshToken, ...rest } = res.payload;
      setAuth({
        accessToken,
        refreshToken,
        deviceInfo: { deviceId, deviceType: params.deviceType },
        user: { ...rest, userType: USER_TYPE.ORG_MEMBER as UserType },
      });

      await Promise.allSettled([
        queryClient.prefetchQuery({ queryKey: MEMBERS_KEY, queryFn: async () => (await apiGetMembersList()).payload.items }),
        queryClient.prefetchQuery({ queryKey: DM_ROOM_LIST_KEY, queryFn: fetchDMRoomList }),
        queryClient.prefetchQuery({ queryKey: GM_ROOM_LIST_KEY, queryFn: fetchGMRoomList }),
        queryClient.prefetchQuery({ queryKey: EM_ROOM_LIST_KEY, queryFn: fetchEMRoomList }),
      ]);

      const members = queryClient.getQueryData<MemberItem[]>(MEMBERS_KEY);
      if (members) {
        const profileKeys = [...new Set(members.map(m => m.profileUrl).filter((key): key is string => !!key))];
        await Promise.allSettled(
          profileKeys.map(key =>
            queryClient.prefetchQuery({
              queryKey: PRESIGNED_URL(key),
              queryFn: async () => (await apiGetStorage(key)).payload.key,
              staleTime: 10 * 60 * 1000,
            }),
          ),
        );
      }

      window.location.href = '/members';
    } catch {
      setIsProcessing(false);
      setLoginError('하이브톡계정 또는 비밀번호를 다시 입력해주세요.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isProcessing) onLogin();
  };

  // 토큰 있는데 쿠키 없으면 로그아웃
  if (accessToken && typeof document !== 'undefined' && !document.cookie.includes('has-auth')) {
    logout();
  }

  return {
    email, setEmail,
    password, setPassword,
    showPassword, setShowPassword,
    isProcessing,
    loginError, setLoginError,
    passwordFocused, setPasswordFocused,
    autoLogin, setAutoLogin,
    isFormFilled,
    accessToken,
    onLogin,
    handleKeyDown,
  };
}
