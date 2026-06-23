'use client';

import type { ComponentType, SVGProps } from 'react';
import {
  IconFileDefault,
  IconFileExcel,
  IconFileHangul,
  IconFilePdf,
  IconFilePpt,
  IconFileWord,
} from '@assets/icons';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** 확장자 → 컬러 파일 타입 아이콘 매핑 (모바일 hivetalk fileIcon.ts 패리티) */
const EXT_ICON_MAP: Record<string, IconComponent> = {
  pdf: IconFilePdf,
  doc: IconFileWord,
  docx: IconFileWord,
  xls: IconFileExcel,
  xlsx: IconFileExcel,
  csv: IconFileExcel,
  ppt: IconFilePpt,
  pptx: IconFilePpt,
  hwp: IconFileHangul,
  hwpx: IconFileHangul,
};

interface FileTypeIconProps {
  /** 확장자 판별용 파일명 (예: "report.pdf") */
  fileName: string;
  /** 정사각 픽셀 크기 (기본 42 — Figma 명세) */
  size?: number;
  className?: string;
}

/** 파일 확장자에 맞는 컬러 아이콘을 렌더한다. 매칭 실패 시 기본 파일 아이콘. */
export function FileTypeIcon({ fileName, size = 42, className }: FileTypeIconProps) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const Icon = EXT_ICON_MAP[ext] ?? IconFileDefault;
  return <Icon width={size} height={size} className={className} />;
}
