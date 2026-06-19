export interface MyProfileUpdateRequestProps {
  companyName?: string | null; // 협력멤버(GUEST)만 수정 가능
  name: string;
  department?: string | null;
  job?: string | null;
  phoneHead?: string | null;
  phoneMid?: string | null;
  phoneTail?: string | null;
  profileUrl?: string | null;
  thumbnailProfileUrl?: string | null;
}

export type MyProfileUpdateResponsePayload = string | null;

export interface MyProfileImageUpdateRequestProps {
  fileName: string;
}

export interface MyProfileImageUpdateResponsePayload {
  putPresignedUrl: string;
  fileKey: string;
}

/**
 * 내 credential 인증/변경 시점 조회 응답.
 *
 * 각 필드는 인증 이력이 없으면 null. 비밀번호는 "변경 시점"이지만
 * 본인 인증을 통과한 시점이므로 UI상 "인증"으로 라벨링한다. (RN 패리티)
 */
export interface CredentialInfoResponsePayload {
  emailVerifiedAt: string | null;
  passwordChangedAt: string | null;
  phoneVerifiedAt: string | null;
}
