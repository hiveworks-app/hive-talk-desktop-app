'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  apiGetCredentialInfo,
  apiUpdateMyProfile,
  apiUpdateMyProfileImage,
} from '@/features/profile/api';
import { MyProfileImageUpdateResponsePayload } from '@/features/profile/type';
import { getErrorMessage, uploadToPresignedUrl } from '@/shared/api';
import { CREDENTIAL_INFO_KEY } from '@/shared/config/queryKeys';
import { toStringSafe } from '@/shared/utils/utils';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';

/**
 * 내 credential(이메일/비밀번호/휴대폰) 인증·변경 시점 조회.
 *
 * - 계정정보 화면 진입 시 호출.
 * - 이메일/비밀번호 변경 mutation 성공 후 invalidateQueries(CREDENTIAL_INFO_KEY)로 동기화한다.
 */
export const useGetCredentialInfo = () => {
  const accessToken = useAuthStore(s => s.accessToken);
  return useQuery({
    queryKey: CREDENTIAL_INFO_KEY,
    queryFn: async () => {
      const res = await apiGetCredentialInfo();
      return res.payload;
    },
    enabled: !!accessToken,
  });
};

export const useMyProfileUpdate = () => {
  const setAuth = useAuthStore(s => s.setAuth);
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return useMutation({
    mutationFn: apiUpdateMyProfile,
    onSuccess: (_res, params) => {
      showSnackbar({
        message: '내 정보가 수정되었습니다.',
        state: 'success',
      });

      const myInfo = useAuthStore.getState().user;
      if (!myInfo) return;

      const user = {
        ...myInfo,
        ...(params.companyName !== undefined && { companyName: params.companyName }),
        name: params.name,
        department: toStringSafe(params.department),
        job: toStringSafe(params.job),
        phoneHead: toStringSafe(params.phoneHead),
        phoneMid: toStringSafe(params.phoneMid),
        phoneTail: toStringSafe(params.phoneTail),
        profileUrl: params.profileUrl ?? null,
        thumbnailProfileUrl: params.thumbnailProfileUrl ?? null,
      };
      setAuth({ user });
    },
  });
};

interface UploadProfileImageVars {
  file: File;
}

export const useMyProfileImageUpload = () => {
  const { showSnackbar } = useUIStore();

  return useMutation<MyProfileImageUpdateResponsePayload, Error, UploadProfileImageVars>({
    mutationFn: async ({ file }) => {
      const fileName = file.name;

      const res = await apiUpdateMyProfileImage({ fileName });
      const payload = res.payload;
      const { putPresignedUrl } = payload;

      const contentType = file.type || 'image/jpeg';
      await uploadToPresignedUrl(putPresignedUrl, file, contentType);

      return payload;
    },
    onError: (err: unknown) => {
      showSnackbar({
        message: getErrorMessage(err, '프로필 이미지 수정 요청에 실패했습니다.'),
        state: 'error',
      });
    },
  });
};
