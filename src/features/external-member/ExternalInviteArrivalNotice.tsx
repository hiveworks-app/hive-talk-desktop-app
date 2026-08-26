'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getInviteNoticeAckCount,
  setInviteNoticeAckCount,
} from '@/features/external-member/inviteArrivalNoticeStorage';
import { useAppRouter } from '@/shared/hooks/useAppRouter';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useAuthStore } from '@/store/auth/authStore';
import { useMemberInviteStore } from '@/store/memberInviteStore';

// 카운트 증가 관측 → 모달 표시까지의 유예 — 로그인 직후 전환 구간과 겹치지 않게 (RN 패리티)
const SHOW_DELAY_MS = 700;

/**
 * 📩 협력멤버 초대장 도착 모달 (RN useExternalInviteArrivalNotice 패리티).
 * 미확인 수신 건수의 "증가 전이" && "ack 워터마크 초과"에만 안내:
 * - 콜드스타트: INIT 0→N 세팅 시 노출 (이미 응답한 건수 이하면 재표시 안 함)
 * - 실시간 수신: BROADCAST +1 → 즉시 노출
 * - 감소(응답/취소)는 노출 없음 + ack 하향 클램프
 * [닫기]/[확인하기] 응답 시 현재 건수를 ack로 기록. 봉투 dot 뱃지와는 독립.
 */
export function ExternalInviteArrivalNotice() {
  const count = useMemberInviteStore(s => s.externalReceivedCount);
  // 중복 노출 가드 (RN 패리티) — ① 초대현황이 이미 열려 있으면(리스트 실시간 갱신 중) 생략
  // ② 소속 초대 수락/거절 컨펌이 떠 있으면 겹쳐 띄우지 않음
  const isInviteStatusOpen = useMemberInviteStore(s => s.isInviteStatusOpen);
  const hasPendingMemberInvite = useMemberInviteStore(s => s.pendingInvite !== null);
  const router = useAppRouter();
  const [noticeCount, setNoticeCount] = useState<number | null>(null);
  const prevCountRef = useRef(0);

  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = count;

    const userId = useAuthStore.getState().user?.id;
    if (userId == null) return;

    // 감소 전이 — ack 하향 동기화 (INIT 절대값 클램프는 WS 핸들러가 수행)
    if (count < prev) {
      const ack = getInviteNoticeAckCount(String(userId));
      if (ack > count) setInviteNoticeAckCount(String(userId), count);
      return;
    }
    if (count <= prev) return;

    const timer = setTimeout(() => {
      const ack = getInviteNoticeAckCount(String(userId));
      if (count <= ack) return;
      setNoticeCount(count);
    }, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [count]);

  if (noticeCount == null || isInviteStatusOpen || hasPendingMemberInvite) return null;

  const recordAck = () => {
    const userId = useAuthStore.getState().user?.id;
    if (userId != null) setInviteNoticeAckCount(String(userId), noticeCount);
    setNoticeCount(null);
  };

  return (
    <ConfirmDialog
      open
      title={`협력멤버 초대가 ${noticeCount}건 도착했어요.`}
      description="초대현황에서 확인해 보세요."
      cancelLabel="닫기"
      confirmLabel="확인하기"
      onCancel={recordAck}
      onConfirm={() => {
        recordAck();
        // 멤버목록으로 이동 + 초대현황 다이얼로그 자동 오픈 요청 (1회 소비)
        useMemberInviteStore.getState().requestOpenInviteStatus();
        router.push('/members');
      }}
    />
  );
}
