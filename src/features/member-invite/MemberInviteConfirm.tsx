'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiGetMembersList } from '@/features/members/api';
import { refreshAccessToken } from '@/shared/api/refreshAccessToken';
import {
  DM_ROOM_LIST_KEY,
  GM_ROOM_LIST_KEY,
  MEMBERS_KEY,
  MY_ORGANIZATION_KEY,
  PINNED_MEMBERS_KEY,
} from '@/shared/config/queryKeys';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { deriveUserType } from '@/shared/utils/permissions';
import { useAuthStore } from '@/store/auth/authStore';
import { useMemberInviteStore } from '@/store/memberInviteStore';
import { useUIStore } from '@/store/uiStore';
import { apiAcceptMemberInvite, apiRejectMemberInvite } from './api';
import type { MemberInvitePayload } from './type';

/**
 * 🏢 사내(소속) 초대 수락/거절 다이얼로그 (RN useMemberInviteHandler 패리티).
 * WS로 수신된 pendingInvite를 감시해 확인 다이얼로그를 띄우고,
 * 수락 시: API → authStore(role/companyId/userType) 갱신 → 토큰 재발급 → 멤버 캐시 재수렴 → 멤버목록 이동.
 */
export function MemberInviteConfirm() {
  const pendingInvite = useMemberInviteStore(s => s.pendingInvite);
  const queryClient = useQueryClient();
  const router = useAppRouter();
  const showSnackbar = useUIStore(s => s.showSnackbar);
  const [isProcessing, setIsProcessing] = useState(false);
  // 만료/취소/삭제된 초대 — 스낵바 대신 모달 안내 (RN handleInviteError 패리티)
  const [isExpiredModalOpen, setExpiredModalOpen] = useState(false);

  const handleInviteError = useCallback(() => {
    setExpiredModalOpen(true);
  }, []);

  const handleAccept = useCallback(
    async (payload: MemberInvitePayload) => {
      if (isProcessing) return;
      setIsProcessing(true);
      // 수락은 API→토큰 재발급→캐시 재수렴 다단계 — 전역 스피너로 진행 표시 (RN 패리티)
      useUIStore.getState().showLoadingOverlay({ message: '초대를 수락하고 있어요' });
      try {
        // 1. 수락 API
        await apiAcceptMemberInvite(payload.inviteId);

        // 2. authStore user 갱신 (role/companyId/userType)
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          const companyId = payload.companyModel.id;
          useAuthStore.getState().setAuth({
            user: { ...currentUser, companyId, role: 'MEMBER', userType: deriveUserType(companyId) },
          });
        }

        // 3. 새 토큰 발급 — 서버 MEMBER role 반영
        const newToken = await refreshAccessToken();
        if (!newToken) {
          showSnackbar({ message: '인증 갱신에 실패했습니다. 앱을 재시작해주세요.', state: 'error' });
          return;
        }

        // 4. 멤버 목록 즉시 재수렴 (+실패 시 invalidate 폴백)
        try {
          const membersRes = await apiGetMembersList();
          queryClient.setQueryData(MEMBERS_KEY, membersRes.payload.items);
        } catch {
          queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
        }
        queryClient.invalidateQueries({ queryKey: PINNED_MEMBERS_KEY });
        queryClient.invalidateQueries({ queryKey: DM_ROOM_LIST_KEY });
        queryClient.invalidateQueries({ queryKey: GM_ROOM_LIST_KEY });
        queryClient.invalidateQueries({ queryKey: MY_ORGANIZATION_KEY });

        showSnackbar({ message: `${payload.companyModel.companyName}에 합류되었어요!`, state: 'success' });
        router.push('/members');
      } catch {
        handleInviteError();
      } finally {
        useUIStore.getState().hideLoadingOverlay();
        setIsProcessing(false);
        useMemberInviteStore.getState().setPendingInvite(null);
      }
    },
    [isProcessing, queryClient, router, showSnackbar, handleInviteError],
  );

  const handleReject = useCallback(
    async (payload: MemberInvitePayload) => {
      useMemberInviteStore.getState().setPendingInvite(null);
      try {
        await apiRejectMemberInvite(payload.inviteId);
        showSnackbar({ message: '초대를 거절했어요.', state: 'error' });
      } catch {
        handleInviteError();
      }
    },
    [showSnackbar, handleInviteError],
  );

  if (!pendingInvite && !isExpiredModalOpen) return null;

  return (
    <>
      {pendingInvite && (
        <ConfirmDialog
          open
          title={`'${pendingInvite.companyModel.companyName}'팀의 초대를 수락할까요?`}
          description="수락 시 소속멤버가 목록에 자동으로 추가돼요."
          cancelLabel="거절"
          confirmLabel="수락"
          onConfirm={() => void handleAccept(pendingInvite)}
          onCancel={() => void handleReject(pendingInvite)}
        />
      )}

      {/* 만료된 초대 안내 (RN showModal 패리티) */}
      {isExpiredModalOpen && (
        <div
          className="electron-no-drag animate-fade-in-fast fixed inset-0 z-[70] flex items-center justify-center bg-black/30"
          onClick={() => setExpiredModalOpen(false)}
        >
          <div
            className="animate-pop-in w-[320px] rounded-xl bg-white p-6"
            onClick={e => e.stopPropagation()}
            role="alertdialog"
          >
            <div className="space-y-2">
              <h3 className="text-heading-md font-semibold text-text-primary">만료된 초대입니다.</h3>
              <p className="text-sub text-gray-700">자세한 내용은 소속 회사 관리자에게 문의해 주세요.</p>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setExpiredModalOpen(false)}
                className="text-body font-medium text-primary hover:underline"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
