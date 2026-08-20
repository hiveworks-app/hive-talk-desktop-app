'use client';

import { useCallback, useState } from 'react';
import { isApiError } from '@/shared/api';
import { useUIStore } from '@/store';
import {
  useInviteExternalByEmail,
  useInviteExternalByPhone,
  useSearchExternalByEmail,
  useSearchExternalByPhone,
} from './queries';

export type InviteTab = 'email' | 'phone';

/** 검색/초대 에러코드 → 사용자 메시지 (모바일 useMemberInvite와 동일 정책) */
const INVITE_ERROR_MESSAGES: Record<string, string> = {
  EXS001: '입력하신 정보와 일치하는 사용자가 없어요.',
  EXS002: '이미 초대한 멤버예요.',
  EXS003: '이미 등록된 멤버예요.',
  EXS004: '본인에게는 초대를 보낼 수 없어요.',
  EXS005: '사내 멤버는 초대할 수 없어요.',
};

const getInviteErrorMessage = (code?: string) =>
  (code && INVITE_ERROR_MESSAGES[code]) || '입력하신 정보와 일치하는 사용자가 없어요.';

interface UseExternalInviteOptions {
  /** 미등록 프로필 진입 — 대상 이메일 프리셋 (이메일 탭 + 값 채움, RN 패리티) */
  presetEmail?: string;
}

/** 확인 다이얼로그 대기 상태 — 검색 결과를 담아 UI가 디자인 컨펌을 띄운다 */
export interface PendingInviteTarget {
  value: string;
  isEmail: boolean;
  userName: string;
  company?: string | null;
  profileUrl?: string | null;
}

/** 초대 성공 카드 데이터 (RN InviteSuccessCard 패리티) */
export interface InviteSuccessData {
  name: string;
  company?: string | null;
  profileUrl?: string | null;
}

/**
 * 외부멤버 검색 후 초대 플로우.
 * 이메일/연락처 탭 → 검색 → 디자인 컨펌 다이얼로그 → 초대 → 성공 카드 (RN useMemberInvite 패리티).
 */
export function useExternalInvite({ presetEmail }: UseExternalInviteOptions = {}) {
  // 기본 탭 = 연락처 (RN InviteTabBar 패리티); 이메일 프리셋 진입 시 이메일 탭
  const [activeTab, setActiveTab] = useState<InviteTab>(presetEmail ? 'email' : 'phone');
  const [inputValue, setInputValue] = useState(presetEmail ?? '');
  const [pendingInvite, setPendingInvite] = useState<PendingInviteTarget | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<InviteSuccessData | null>(null);

  const showSnackbar = useUIStore(s => s.showSnackbar);
  const showLoadingOverlay = useUIStore(s => s.showLoadingOverlay);
  const hideLoadingOverlay = useUIStore(s => s.hideLoadingOverlay);

  const { mutateAsync: searchByEmail, isPending: isEmailSearching } = useSearchExternalByEmail();
  const { mutateAsync: searchByPhone, isPending: isPhoneSearching } = useSearchExternalByPhone();
  const { mutateAsync: inviteByEmail } = useInviteExternalByEmail();
  const { mutateAsync: inviteByPhone } = useInviteExternalByPhone();

  const isSearching = isEmailSearching || isPhoneSearching;
  const isDisabled = !inputValue.trim() || isSearching;

  /** 입력 정제: 연락처 탭은 숫자만 11자리, 이메일은 그대로. 숫자 외 입력은 안내 (RN 패리티) */
  const handleInputChange = useCallback(
    (text: string) => {
      if (activeTab === 'phone') {
        const digitsOnly = text.replace(/[^0-9]/g, '');
        if (digitsOnly !== text) {
          showSnackbar({ message: '숫자만 입력할 수 있어요.', state: 'error' });
        }
        setInputValue(digitsOnly.slice(0, 11));
      } else {
        setInputValue(text);
      }
    },
    [activeTab, showSnackbar],
  );

  /** 탭 전환 시 입력·성공 상태 초기화 (RN useMemberInvite 패리티) */
  const handleTabChange = useCallback(
    (tab: InviteTab) => {
      if (tab === activeTab) return;
      setActiveTab(tab);
      setInputValue('');
      setInviteSuccess(null);
    },
    [activeTab],
  );

  // 이메일 형식 클라이언트 검증 없음 — RN과 동일하게 서버 검증(EXS001)에 위임
  const handleConfirm = useCallback(async () => {
    if (isDisabled) return;
    const value = inputValue.trim();
    const isEmail = activeTab === 'email';

    try {
      // 1) 검색 — 실패(EXS001 등)는 아래 catch에서 처리
      const res = isEmail ? await searchByEmail(value) : await searchByPhone(value);
      const userName = res.payload?.name ?? '사용자';
      const company = res.payload?.company;
      // RN 패리티 — 성공 카드에 검색된 실제 프로필 이미지 표시
      const profileUrl = res.payload?.thumbnailProfileUrl ?? null;

      // 2) 확인 — 디자인 컨펌 다이얼로그로 위임 (RN showConfirm 대응)
      setPendingInvite({ value, isEmail, userName, company, profileUrl });
    } catch (searchErr) {
      const code = isApiError(searchErr) ? searchErr.code : undefined;
      showSnackbar({ message: getInviteErrorMessage(code), state: 'error' });
    }
  }, [isDisabled, inputValue, activeTab, searchByEmail, searchByPhone, showSnackbar]);

  /** 컨펌 '초대' — 실제 초대 실행 → 성공 카드 표시 (RN InviteSuccessCard 패리티) */
  const confirmInvite = useCallback(async () => {
    const target = pendingInvite;
    if (!target) return;
    setPendingInvite(null);
    showLoadingOverlay({ message: '초대 중...' });
    try {
      if (target.isEmail) await inviteByEmail(target.value);
      else await inviteByPhone(target.value);
      setInputValue('');
      // 성공 카드가 다이얼로그 안에 표시되므로 여기서 닫지 않는다 — 카드 [확인]이 다이얼로그를 닫는다
      setInviteSuccess({ name: target.userName, company: target.company, profileUrl: target.profileUrl });
    } catch (inviteErr) {
      const code = isApiError(inviteErr) ? inviteErr.code : undefined;
      showSnackbar({ message: getInviteErrorMessage(code), state: 'error' });
    } finally {
      hideLoadingOverlay();
    }
  }, [pendingInvite, inviteByEmail, inviteByPhone, showSnackbar, showLoadingOverlay, hideLoadingOverlay]);

  const cancelInvite = useCallback(() => setPendingInvite(null), []);
  const clearInviteSuccess = useCallback(() => setInviteSuccess(null), []);

  return {
    activeTab,
    inputValue,
    isDisabled,
    isSearching,
    pendingInvite,
    inviteSuccess,
    handleInputChange,
    handleTabChange,
    handleConfirm,
    confirmInvite,
    cancelInvite,
    clearInviteSuccess,
  };
}
