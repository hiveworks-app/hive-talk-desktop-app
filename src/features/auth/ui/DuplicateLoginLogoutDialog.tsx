'use client';

import { useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { handleForceLogout } from '@/shared/api/refreshAccessToken';
import { Button } from '@/shared/ui/Button';
import { useSessionDisconnectStore } from '@/store/auth/sessionDisconnectStore';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { useEscSuppress } from '@/shared/hooks/useEscSuppress';

/**
 * 중복 로그인(SC010) 강제 종료 안내 다이얼로그 (RN 패리티, Figma 3300:62648).
 * 백드롭/ESC로 닫히지 않고 '확인'으로만 닫힘 — 확인 시점에 로그아웃 후 로그인 화면 이동.
 * 감지 경로(WS SESSION/DISCONNECT · REST 401 · refresh 거절)와 무관하게
 * sessionDisconnectStore.noticeVisible 하나로 표시된다.
 */
export function DuplicateLoginLogoutDialog() {
  const visible = useSessionDisconnectStore(s => s.noticeVisible);
  useDimmed(visible);
  // ESC-닫기가 막힌 모달이므로 떠 있는 동안 ESC는 완전 no-op — 억제 없으면 메인이 창만 숨긴다
  useEscSuppress(visible);

  const handleConfirm = useCallback(() => {
    useSessionDisconnectStore.getState().hideNotice();
    handleForceLogout();
  }, []);

  return (
    <Dialog.Root open={visible}>
      <Dialog.Portal>
        <Dialog.Overlay className="motion-dim fixed inset-0 z-[90] bg-black/40" />
        <Dialog.Content
          className="motion-center-pop fixed left-1/2 top-1/2 z-[95] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl focus:outline-none"
          onPointerDownOutside={e => e.preventDefault()}
          onEscapeKeyDown={e => e.preventDefault()}
        >
          <Dialog.Title className="text-center text-heading-md font-bold text-gray-900">
            로그아웃
          </Dialog.Title>
          <Dialog.Description className="mt-3 whitespace-pre-line text-center text-sm text-gray-500">
            {'다른 기기에서 로그인 하여 로그아웃됐어요.\n확인 시 로그인 화면으로 이동돼요.'}
          </Dialog.Description>
          <div className="mt-6">
            <Button variant="primary" size="lg" fullWidth onClick={handleConfirm}>
              확인
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
