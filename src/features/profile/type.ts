export interface MyProfileUpdateRequestProps {
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
