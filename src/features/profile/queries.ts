'use client';

import { useMutation } from '@tanstack/react-query';
import { apiUpdateMyProfile, apiUpdateMyProfileImage } from '@/features/profile/api';
import { MyProfileImageUpdateResponsePayload } from '@/features/profile/type';
import { uploadToPresignedUrl } from '@/shared/api';
import { toStringSafe } from '@/shared/utils/utils';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/auth/authStore';

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
    onError: () => {
      showSnackbar({
        message: '프로필 이미지 수정 요청에 실패했습니다.',
        state: 'error',
      });
    },
  });
};
