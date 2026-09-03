'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useDimmed } from '@/shared/hooks/useDimmed';
import { useEscSuppress } from '@/shared/hooks/useEscSuppress';
import { isApiError } from '@/shared/api';
import { useGetReportCategories, useReportMessage } from '@/features/report-message/queries';
import { FALLBACK_REPORT_CATEGORIES, REPORT_DETAIL_INFO_TEXT } from '@/features/report-message/reportCategories';
import { isReportRoomType, type ReportCategory } from '@/features/report-message/type';
import { Button } from '@/shared/ui/Button';
import IconCloseStroke from '@assets/icons/close-stroke.svg';
import { IconChevronLeft, IconChevronRight, IconReport } from '@/shared/ui/icons';
import { useUIStore } from '@/store/uiStore';

const MAX_REPORT_CONTENT_LENGTH = 300;
const REPORT_SUBMIT_FAIL_MESSAGE = '신고 접수에 실패했어요. 잠시 후 다시 시도해 주세요.';

interface ReportMessageDialogProps {
  open: boolean;
  /** DM/GM/EM. 내부에서 isReportRoomType 으로 검증한다. */
  roomType: string;
  roomId: string;
  messageId: string;
  onClose: () => void;
}

/**
 * 메시지 신고 모달 (모바일 2-스텝 화면을 데스크톱 단일 모달로 매핑).
 * 1단계 카테고리 선택 → 2단계 세부(위반행위/ETC 자유입력/주의사항) → 접수 확인 → POST.
 */
export function ReportMessageDialog({ open, roomType, roomId, messageId, onClose }: ReportMessageDialogProps) {
  // 어두운 스크림 → 창 버튼(WCO) 딤 동기화 (2026-09-02 전수 점검 누락분)
  useDimmed(open);
  // ESC=다이얼로그 닫기만 — 억제 없으면 Radix가 닫는 순간 메인이 창을 트레이로 숨긴다 (2026-09-03)
  useEscSuppress(open);
  const { data } = useGetReportCategories();
  const { categories, notice } = data ?? FALLBACK_REPORT_CATEGORIES;
  const reportMutation = useReportMessage();
  const showToast = useUIStore(s => s.showToast);
  const showSnackbar = useUIStore(s => s.showSnackbar);

  const [selected, setSelected] = useState<ReportCategory | null>(null);
  const [content, setContent] = useState('');
  const [confirming, setConfirming] = useState(false);

  const requiresDetail = Boolean(selected?.requiresDetail);
  const isSubmitEnabled = (!requiresDetail || content.trim().length > 0) && !reportMutation.isPending;

  const resetAndClose = () => {
    setSelected(null);
    setContent('');
    setConfirming(false);
    onClose();
  };

  const handleConfirmReport = async () => {
    // 정상 플로우에서는 항상 채워지는 값들 — 누락 시 접수 차단(방어 코드)
    if (!selected || !messageId || !roomId || !isReportRoomType(roomType)) {
      showSnackbar({ message: REPORT_SUBMIT_FAIL_MESSAGE, state: 'error' });
      return;
    }

    try {
      await reportMutation.mutateAsync({
        roomType,
        roomId,
        messageId,
        reasonCategory: selected.code,
        ...(requiresDetail ? { reasonDetail: content.trim() } : {}),
      });
      showToast({ message: '신고가 접수되었어요.', state: 'success' });
      resetAndClose();
    } catch (err) {
      // RP003(409, 이미 신고한 메시지): 재시도가 무의미하므로 안내 후 종료
      if (isApiError(err) && err.code === 'RP003') {
        showToast({ message: err.message || '이미 신고한 메시지예요.' });
        resetAndClose();
        return;
      }
      setConfirming(false);
      showSnackbar({
        message: isApiError(err) ? err.message || REPORT_SUBMIT_FAIL_MESSAGE : REPORT_SUBMIT_FAIL_MESSAGE,
        state: 'error',
      });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) resetAndClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="motion-dim fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="motion-center-pop fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[420px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-xl focus:outline-none">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-1.5">
              {selected && (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-gray-500 hover:text-gray-900"
                  aria-label="이전 단계로"
                >
                  <IconChevronLeft size={20} />
                </button>
              )}
              <Dialog.Title className="text-heading-md font-bold text-gray-900">신고하기</Dialog.Title>
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              className="text-gray-900"
              aria-label="신고 닫기"
            >
              <IconCloseStroke width={20} height={20} />
            </button>
          </div>

          {/* 본문 */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!selected ? (
              <CategoryList categories={categories} notice={notice} onSelect={setSelected} />
            ) : (
              <CategoryDetail
                category={selected}
                content={content}
                onChangeContent={setContent}
                requiresDetail={requiresDetail}
              />
            )}
          </div>

          {/* 세부 단계 CTA */}
          {selected && (
            <div className="border-t border-gray-100 p-4">
              <Button variant="primary" size="lg" fullWidth disabled={!isSubmitEnabled} onClick={() => setConfirming(true)}>
                <span className="flex items-center justify-center gap-2">
                  <IconReport size={18} /> 신고 접수하기
                </span>
              </Button>
            </div>
          )}

          {/* 접수 확인 (uiStore에 showConfirm이 없어 모달 내부 오버레이로 대체) */}
          {confirming && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/30">
              <div className="w-[300px] rounded-2xl bg-white p-5 shadow-xl">
                <p className="text-center text-heading-md font-bold text-gray-900">신고를 접수할까요?</p>
                <p className="mt-2 text-center text-sm text-gray-500">접수된 신고는 취소할 수 없습니다.</p>
                <div className="mt-5 flex gap-2">
                  <Button variant="primary-light" size="lg" fullWidth disabled={reportMutation.isPending} onClick={() => setConfirming(false)}>
                    취소
                  </Button>
                  <Button variant="primary" size="lg" fullWidth disabled={reportMutation.isPending} onClick={handleConfirmReport}>
                    접수
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface CategoryListProps {
  categories: ReportCategory[];
  notice: string;
  onSelect: (category: ReportCategory) => void;
}

function CategoryList({ categories, notice, onSelect }: CategoryListProps) {
  return (
    <div>
      <ul>
        {categories.map((category) => (
          <li key={category.code}>
            <button
              type="button"
              onClick={() => onSelect(category)}
              className="flex w-full items-center justify-between border-b border-gray-100 py-3.5 text-left hover:bg-gray-50"
            >
              <span className="text-sm font-semibold text-gray-900">{category.name}</span>
              <IconChevronRight size={16} className="text-gray-400" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-6 rounded-xl bg-gray-100 p-3">
        <p className="text-xs leading-relaxed text-gray-600">{notice}</p>
      </div>
    </div>
  );
}

interface CategoryDetailProps {
  category: ReportCategory;
  content: string;
  onChangeContent: (value: string) => void;
  requiresDetail: boolean;
}

function CategoryDetail({ category, content, onChangeContent, requiresDetail }: CategoryDetailProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h3 className="text-heading-md font-bold text-gray-900">{category.name}</h3>
        <ul className="flex flex-col gap-1">
          {category.descriptions.map((description) => (
            <li key={description} className="flex text-sm text-gray-800">
              <span className="mr-2">•</span>
              <span className="flex-1">{description}</span>
            </li>
          ))}
        </ul>
      </div>

      {requiresDetail && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-gray-900">신고 내용</label>
          <textarea
            value={content}
            onChange={(e) => onChangeContent(e.target.value)}
            placeholder="신고 내용을 입력해야 신고 접수가 가능해요."
            maxLength={MAX_REPORT_CONTENT_LENGTH}
            className="h-32 resize-none rounded-2xl border border-gray-200 p-4 text-sm text-gray-900 outline-none focus:border-gray-400"
          />
          <span className="self-end text-xs font-medium text-gray-500">
            {content.length}/{MAX_REPORT_CONTENT_LENGTH}
          </span>
        </div>
      )}

      <div className="rounded-xl bg-gray-100 p-3">
        <p className="text-xs leading-relaxed text-gray-600">{REPORT_DETAIL_INFO_TEXT}</p>
      </div>

      {category.caution && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">!</span>
            <span className="text-sm font-semibold text-red-500">주의사항</span>
          </div>
          <p className="text-sm font-medium text-red-500">{category.caution}</p>
        </div>
      )}
    </div>
  );
}
