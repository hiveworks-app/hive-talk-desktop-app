'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth/authStore';

export const useMyProfileHook = () => {
  const router = useRouter();
  const myInfo = useAuthStore(state => state.user);
  const name = myInfo?.name;
  const department = myInfo?.department;
  const job = myInfo?.job;
  const email = myInfo?.email;
  const phoneHead = myInfo?.phoneHead;
  const phoneMid = myInfo?.phoneMid;
  const phoneTail = myInfo?.phoneTail;
  const phone = [myInfo?.phoneHead, myInfo?.phoneMid, myInfo?.phoneTail].join('-');
  const profileUrl = myInfo?.profileUrl;
  const profileImageUrl = myInfo?.profileImageUrl;
  const thumbnailProfileUrl = myInfo?.thumbnailProfileUrl;

  useEffect(() => {
    if (!myInfo) {
      useAuthStore.getState().logout();
      router.replace('/login');
    }
  }, [myInfo, router]);

  return {
    myInfo,
    name,
    department,
    job,
    email,
    phone,
    phoneHead,
    phoneMid,
    phoneTail,
    profileUrl,
    profileImageUrl,
    thumbnailProfileUrl,
  };
};
