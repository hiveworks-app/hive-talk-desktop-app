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
  /** 초대 성공 시 콜백 (폼 닫기 등) */
  onInvited?: () => void;
}

/**
 * 외부멤버 검색 후 초대 플로우.
 * 이메일/연락처 탭 → 검색 → window.confirm 확인 → 초대.
 * (모바일 features/member-invite/useMemberInvite 이식 — showConfirm 대신 데스크톱 window.confirm)
 */
export function useExternalInvite({ onInvited }: UseExternalInviteOptions = {}) {
  const [activeTab, setActiveTab] = useState<InviteTab>('email');
  const [inputValue, setInputValue] = useState('');

  const showSnackbar = useUIStore(s => s.showSnackbar);
  const showLoadingOverlay = useUIStore(s => s.showLoadingOverlay);
  const hideLoadingOverlay = useUIStore(s => s.hideLoadingOverlay);

  const { mutateAsync: searchByEmail, isPending: isEmailSearching } = useSearchExternalByEmail();
  const { mutateAsync: searchByPhone, isPending: isPhoneSearching } = useSearchExternalByPhone();
  const { mutateAsync: inviteByEmail } = useInviteExternalByEmail();
  const { mutateAsync: inviteByPhone } = useInviteExternalByPhone();

  const isSearching = isEmailSearching || isPhoneSearching;
  const isDisabled = !inputValue.trim() || isSearching;

  /** 입력 정제: 연락처 탭은 숫자만 11자리, 이메일은 그대로 */
  const handleInputChange = useCallback(
    (text: string) => {
      if (activeTab === 'phone') {
        setInputValue(text.replace(/[^0-9]/g, '').slice(0, 11));
      } else {
        setInputValue(text);
      }
    },
    [activeTab],
  );

  /** 탭 전환 시 입력 초기화 */
  const handleTabChange = useCallback(
    (tab: InviteTab) => {
      if (tab === activeTab) return;
      setActiveTab(tab);
      setInputValue('');
    },
    [activeTab],
  );

  const handleConfirm = useCallback(async () => {
    if (isDisabled) return;
    const value = inputValue.trim();
    const isEmail = activeTab === 'email';

    if (isEmail && !value.includes('@')) {
      showSnackbar({ message: '올바른 이메일을 입력해 주세요.', state: 'error' });
      return;
    }

    try {
      // 1) 검색 — 실패(EXS001 등)는 아래 catch에서 처리
      const res = isEmail ? await searchByEmail(value) : await searchByPhone(value);
      const userName = res.payload?.name ?? '사용자';
      const company = res.payload?.company;

      // 2) 확인 (데스크톱: uiStore에 showConfirm이 없어 window.confirm 사용)
      const who = company ? `${userName} (${company})` : userName;
      if (!window.confirm(`${who}님을 멤버로 초대할까요?\n상대방이 수락하면 멤버로 등록돼요.`)) return;

      // 3) 초대
      showLoadingOverlay({ message: '초대 중...' });
      try {
        if (isEmail) await inviteByEmail(value);
        else await inviteByPhone(value);
        showSnackbar({ message: '초대를 보냈습니다.', state: 'success' });
        setInputValue('');
        onInvited?.();
      } catch (inviteErr) {
        const code = isApiError(inviteErr) ? inviteErr.code : undefined;
        showSnackbar({ message: getInviteErrorMessage(code), state: 'error' });
      } finally {
        hideLoadingOverlay();
      }
    } catch (searchErr) {
      const code = isApiError(searchErr) ? searchErr.code : undefined;
      showSnackbar({ message: getInviteErrorMessage(code), state: 'error' });
    }
  }, [
    isDisabled,
    inputValue,
    activeTab,
    searchByEmail,
    searchByPhone,
    inviteByEmail,
    inviteByPhone,
    showSnackbar,
    showLoadingOverlay,
    hideLoadingOverlay,
    onInvited,
  ]);

  return {
    activeTab,
    inputValue,
    isDisabled,
    isSearching,
    handleInputChange,
    handleTabChange,
    handleConfirm,
  };
}
