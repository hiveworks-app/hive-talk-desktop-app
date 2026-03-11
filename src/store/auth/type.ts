import type { LoginResponseProps } from '@/features/auth/type';
import type { OrganizationInfo, UserType } from '@/shared/types/user';

export interface AuthSaveUserInfoTypes
  extends Omit<LoginResponseProps, 'accessToken' | 'refreshToken'> {
  profileImageUrl?: string | null;
  thumbnailProfileUrl?: string | null;
  userType: UserType;
  organization?: OrganizationInfo;
}

export type DeviceInfoTypes = {
  deviceId: string;
  deviceType: 'DESKTOP';
};

export interface SetAuthProps {
  accessToken?: string;
  refreshToken?: string;
  deviceInfo?: DeviceInfoTypes;
  user?: AuthSaveUserInfoTypes;
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  deviceInfo: DeviceInfoTypes | null;
  user: AuthSaveUserInfoTypes | null;
  setAuth: (props: SetAuthProps) => void;
  logout: () => void;
}
