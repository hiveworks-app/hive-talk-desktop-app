'use client';

import { useSyncExternalStore, useState, useRef, useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { del } from 'idb-keyval';
import { useLogin } from '@/features/auth/queries';
import { DUPLICATE_LOGIN_ERROR_CODE, type LoginRequestProps } from '@/features/auth/type';
import { isApiError } from '@/shared/api';
import { consumePendingDismissedToast } from '@/shared/utils/pendingDismissedToast';
import { ACCOUNT_SUSPENDED_ERROR_CODE, isAccountSuspendedPayload, type AccountSuspendedPayload } from '@/shared/types/account';
import { useUIStore } from '@/store/uiStore';
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
import { deriveUserType } from '@/shared/utils/permissions';
import { getBrowserDeviceId } from '@/shared/utils/deviceId';
import { useAuthStore } from '@/store/auth/authStore';

// local@domain.tld 골격만 검사 — `a@`, `a@b`처럼 도메인이 불완전한 입력을 걸러낸다. (RN 패리티)
const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmailFormat = (text: string): boolean => EMAIL_FORMAT_REGEX.test(text.trim());

export type LoginErrorField = 'email' | 'password';

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
  // 필드별 인라인 에러 — 해당 Input에 빨강 보더 + 바로 아래 문구 (RN LoginScreen 패리티)
  const [loginError, setLoginError] = useState('');
  const [loginErrorField, setLoginErrorField] = useState<LoginErrorField | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const autoLoginStored = useSyncExternalStore(
    cb => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb); },
    () => localStorage.getItem('auto-login') === 'true',
    () => false,
  );
  const [autoLogin, setAutoLogin] = useState(autoLoginStored);
  // 중복 로그인(SC009) 확인 다이얼로그 + '계속' 재시도용 파라미터 보관.
  // 동일 deviceId로 재시도해야 서버가 같은 요청으로 인식한다 (RN 패리티)
  const [isDuplicateLoginVisible, setDuplicateLoginVisible] = useState(false);
  // 계정 정지(SC008) 로그인 응답 — 정지 안내 모달 (RN 패리티)
  const [suspendedInfo, setSuspendedInfo] = useState<AccountSuspendedPayload | null | undefined>(undefined);
  const pendingLoginParamsRef = useRef<LoginRequestProps | null>(null);

  const isFormFilled = email.trim().length > 0 && password.trim().length > 0;

  const clearLoginError = () => {
    setLoginError('');
    setLoginErrorField(null);
  };

  // 실시간 이메일 형식 검증 — 비어있을 땐 검증하지 않고, 내용이 있고 형식이 아니면 즉시 안내 (RN 패리티)
  const handleEmailChange = (text: string) => {
    setEmail(text);
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      if (loginErrorField === 'email') clearLoginError();
      return;
    }
    if (!isValidEmailFormat(trimmed)) {
      setLoginError('아이디가 이메일 형식이 아닙니다.');
      setLoginErrorField('email');
      return;
    }
    if (loginErrorField === 'email') clearLoginError();
  };

  // password 입력 시 email 실시간 에러는 유지 — 비밀번호 칸 타이핑으로 이메일 오류가 사라지면 혼란 (RN 패리티)
  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (loginErrorField === 'password') clearLoginError();
  };

  const validateLoginInfo = (): { message: string; field: LoginErrorField } | null => {
    const _email = email.trim();
    const _password = password.trim();
    if (_email.length === 0) {
      setEmail('');
      return { message: '접속하실 계정의 아이디(이메일)를 입력하세요.', field: 'email' };
    }
    if (_password.length === 0) {
      setPassword('');
      return { message: '접속하실 계정의 비밀번호를 입력하세요.', field: 'password' };
    }
    if (!isValidEmailFormat(_email)) {
      return { message: '아이디가 이메일 형식이 아닙니다.', field: 'email' };
    }
    return null;
  };

  // 소속 해제 강제 로그아웃 후 1회 안내 (정책 member.md §소속 해제 — "앱 진입 시" 토스트)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (consumePendingDismissedToast()) {
        useUIStore.getState().showSnackbar({ message: '소속이 해제되었어요.', state: 'error' });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const performLogin = async (params: LoginRequestProps) => {
    const res = await login(params);

    localStorage.setItem('auto-login', String(autoLogin));
    queryClient.clear();
    await del('hiveworks-query-cache');

    const { accessToken, refreshToken, ...rest } = res.payload;
    // userType은 서버 값이 아니라 companyId 기반으로 파생한다 (GUEST=null → EXTERNAL_USER). RN 패리티.
    const userType = deriveUserType(rest.companyId);
    setAuth({
      accessToken,
      refreshToken,
      deviceInfo: { deviceId: params.deviceId, deviceType: params.deviceType },
      user: { ...rest, userType },
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

    // GUEST(소속 없음)는 협력채팅으로, 소속 유저는 멤버목록으로 진입 (RN 패리티)
    window.location.href = userType === USER_TYPE.ORG_MEMBER ? '/members' : '/external-chat';
  };

  // 분기 우선순위: SC009(중복 로그인) → SC008(계정 정지) → 크레덴셜 에러 (RN 패리티)
  const handleLoginError = (err: unknown) => {
    if (isApiError(err) && err.code === DUPLICATE_LOGIN_ERROR_CODE) {
      setDuplicateLoginVisible(true);
      return;
    }
    if (isApiError(err) && err.code === ACCOUNT_SUSPENDED_ERROR_CODE) {
      // 정지 상세(payload)가 있으면 함께 표시, 없으면 일반 안내
      const raw = (err.payload as { payload?: unknown } | null)?.payload ?? err.payload;
      setSuspendedInfo(isAccountSuspendedPayload(raw) ? raw : null);
      setPassword('');
      return;
    }
    // 서버 인증 실패(SC001 등) → 비밀번호 아래 인라인 에러. SC001은 이메일/비밀번호 어느 쪽이
    // 틀렸는지 서버가 구분하지 않으므로 인접 필드(password)에 보더를 매칭 (RN 패리티).
    setLoginError(
      isApiError(err)
        ? '하이브톡계정 또는 비밀번호를 다시 확인해주세요.'
        : '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.',
    );
    setLoginErrorField('password');
    // 실패 시 비밀번호 초기화 후 재포커스 — 사용자가 직접 지우는 부담 없이 즉시 재입력 (RN 패리티)
    setPassword('');
    passwordInputRef.current?.focus();
  };

  const onLogin = async () => {
    const validation = validateLoginInfo();
    if (validation) {
      setLoginError(validation.message);
      setLoginErrorField(validation.field);
      return;
    }

    if (!navigator.onLine) {
      setLoginError('오프라인 상태에서는 로그인할 수 없습니다.');
      setLoginErrorField('password');
      return;
    }

    setIsProcessing(true);
    try {
      const deviceId = getBrowserDeviceId();
      const params: LoginRequestProps = {
        deviceToken: deviceId,
        deviceType: 'DESKTOP' as const,
        deviceId,
        email: email.trim(),
        password: password.trim(),
        force: false, // 최초 시도는 강제 로그인 아님 — 중복 세션 시 서버가 SC009 응답
      };
      pendingLoginParamsRef.current = params;

      await performLogin(params);
    } catch (err) {
      setIsProcessing(false);
      handleLoginError(err);
    }
  };

  // 중복 로그인 다이얼로그 '계속' — 동일 파라미터 + force: true 재시도 (기존 기기 로그아웃)
  const handleDuplicateLoginContinue = async () => {
    const params = pendingLoginParamsRef.current;
    if (!params) return;
    setDuplicateLoginVisible(false);
    setIsProcessing(true);
    try {
      await performLogin({ ...params, force: true });
    } catch (err) {
      setIsProcessing(false);
      handleLoginError(err);
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
    email, handleEmailChange,
    password, handlePasswordChange, setPassword,
    showPassword, setShowPassword,
    isProcessing,
    loginError, loginErrorField, clearLoginError,
    passwordInputRef,
    passwordFocused, setPasswordFocused,
    autoLogin, setAutoLogin,
    isFormFilled,
    accessToken,
    onLogin,
    handleKeyDown,
    isDuplicateLoginVisible,
    closeDuplicateLogin: () => setDuplicateLoginVisible(false),
    handleDuplicateLoginContinue,
    suspendedInfo,
    closeSuspendedDialog: () => setSuspendedInfo(undefined),
  };
}
