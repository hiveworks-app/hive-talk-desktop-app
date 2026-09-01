'use client';

import { useDimmed } from '@/shared/hooks/useDimmed';

/**
 * 선택 동의(마케팅/광고성) 변경 확인 다이얼로그 (RN ConsentChangeDialog 패리티).
 * 정보통신망법 고지 성격 — 토글 성공 시 종류×액션별 카피 + 변경일자 `(YYYY.M.D)`를 모달로 안내한다.
 */

export type ConsentDialogType = 'marketing' | 'adInfo';
/** agree=동의/ON, revoke=철회/OFF */
export type ConsentDialogAction = 'agree' | 'revoke';

interface DialogCopy {
  title: string;
  /** 본문 — `(YYYY.M.D)`는 컴포넌트에서 추가하므로 여기엔 포함하지 않는다. */
  body: string;
}

const COPY_MAP: Record<ConsentDialogType, Record<ConsentDialogAction, DialogCopy>> = {
  marketing: {
    agree: {
      title: '마케팅 목적 개인정보 이용에 동의했어요.',
      body: '하이브톡의 이벤트, 혜택 등 마케팅 알림을 받을 수 있어요.',
    },
    revoke: {
      title: '마케팅 목적 개인정보 이용동의를 철회했어요.',
      body: '철회 시 하이브톡의 이벤트, 혜택 등 마케팅 알림을 더 이상 받지 못해요.',
    },
  },
  adInfo: {
    agree: {
      title: '광고성 정보 수신에 동의했어요.',
      body: '하이브톡의 광고, 프로모션 등의 알림을 받을 수 있어요.',
    },
    revoke: {
      title: '광고성 정보 수신동의를 철회했어요.',
      body: '철회 시 하이브톡의 광고, 프로모션 등의 알림을 더 이상 받지 못해요.',
    },
  },
};

// Figma 정본: "(2026.5.6)" — zero-pad/공백 없이 YYYY.M.D
function formatChangedDate(date: Date) {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

interface ConsentChangeDialogProps {
  open: boolean;
  consentType: ConsentDialogType;
  action: ConsentDialogAction;
  /** 본문에 표시될 결정 날짜 — 다이얼로그가 열린 순간을 호출부가 고정해 전달한다. */
  changedAt: Date;
  onClose: () => void;
}

export function ConsentChangeDialog({
  open,
  consentType,
  action,
  changedAt,
  onClose,
}: ConsentChangeDialogProps) {
  useDimmed(open);
  if (!open) return null;
  const copy = COPY_MAP[consentType][action];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-[320px] rounded-xl bg-white p-6"
        onClick={e => e.stopPropagation()}
        role="alertdialog"
        aria-label={copy.title}
      >
        <div className="space-y-2">
          <h3 className="text-heading-md font-semibold text-text-primary">{copy.title}</h3>
          <p className="text-sub-lg text-gray-700">
            {copy.body} ({formatChangedDate(changedAt)})
          </p>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-body font-medium text-primary hover:underline"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
