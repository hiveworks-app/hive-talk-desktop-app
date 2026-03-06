'use client';

import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';

export function CompanyStep({
  companyName,
  onChangeCompanyName,
  department,
  onChangeDepartment,
  job,
  onChangeJob,
  onSubmit,
}: {
  companyName: string;
  onChangeCompanyName: (v: string) => void;
  department: string;
  onChangeDepartment: (v: string) => void;
  job: string;
  onChangeJob: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4">
      <div className="space-y-6">
        {/* 타이틀 */}
        <div className="flex items-center gap-2 pt-4">
          <h2 className="text-heading-lg font-semibold text-text-primary">회사정보 입력</h2>
          <span className="text-body text-text-tertiary">(선택)</span>
        </div>

        <Input
          value={companyName}
          onChange={e => onChangeCompanyName(e.target.value)}
          placeholder="회사명"
          className="h-11"
        />
        <Input
          value={department}
          onChange={e => onChangeDepartment(e.target.value)}
          placeholder="부서명"
          className="h-11"
        />
        <Input
          value={job}
          onChange={e => onChangeJob(e.target.value)}
          placeholder="직급"
          className="h-11"
        />

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onSubmit}
        >
          다음
        </Button>
      </div>
    </div>
  );
}
