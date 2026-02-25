import { ApiResponse } from "@/shared/api";

export type DeviceTypes = "DESKTOP";

interface CommonAuthRequestProps {
  deviceToken: string;
  deviceType: DeviceTypes;
  deviceId: string;
}

export interface LoginRequestProps extends CommonAuthRequestProps {
  email: string;
  password: string;
}

export interface LoginResponseProps {
  id: string;
  companyId: string;
  email: string;
  name: string;
  department: string | null;
  job: string | null;
  phoneHead: string | null;
  phoneMid: string | null;
  phoneTail: string | null;
  lastLoginAt: Date;
  profileUrl: string | null;
  role: string;
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
