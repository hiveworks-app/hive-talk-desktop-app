import { ApiResponse } from "@/shared/api";
import type { UserRole } from "@/shared/types/user";

export type DeviceTypes = "DESKTOP";

interface CommonAuthRequestProps {
  deviceToken: string;
  deviceType: DeviceTypes;
  deviceId: string;
}

export interface LoginRequestProps extends CommonAuthRequestProps {
  email: string;
  password: string;
  /** 강제 로그인 — 기본 false. 중복 로그인(SC009) 다이얼로그에서 '계속' 선택 시 true로 재시도(기존 기기 세션 대체) */
  force: boolean;
}

/** 중복 로그인(SC009) — 다른 기기에 활성 세션이 있을 때 로그인 차단 응답 ("다른 기기에서 로그인되어 있습니다.") */
export const DUPLICATE_LOGIN_ERROR_CODE = 'SC009';

export interface LoginResponseProps {
  id: string;
  companyId: string | null; // 소속 회사 인덱스 (GUEST는 null)
  email: string;
  name: string;
  department: string | null;
  job: string | null;
  phoneHead: string | null;
  phoneMid: string | null;
  phoneTail: string | null;
  lastLoginAt: Date;
  profileUrl: string | null;
  companyName: string | null; // 협력멤버(GUEST)의 소속 회사명
  role: UserRole; // 권한 (GUEST | MEMBER | ADMIN)
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenRequestProps extends CommonAuthRequestProps {
  userId: string;
  refreshToken: string;
}

export interface RefreshTokenResponseProps {
  code: string;
  success: boolean;
  message: string;
  payload: {
    accessToken: string;
    refreshToken: string;
    refreshTokenExpiredAt: Date;
  };
}

export type LoginErrorResponse = ApiResponse<null>;
