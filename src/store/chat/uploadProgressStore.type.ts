import type { LocalSendStatus } from '@/shared/types/websocket';

export interface UploadProgressEntry {
  done: number;
  total: number;
  status: LocalSendStatus;
}

export interface UploadProgressState {
  byFileId: Record<string, UploadProgressEntry | undefined>;
  setTransmissionProgress: (fileId: string, next: UploadProgressEntry) => void;
  clearProgress: (fileId: string) => void;
  clearAll: () => void;
}
