'use client';

import { create } from 'zustand';
import { LocalSendStatus } from '@/shared/types/websocket';

export interface UploadProgressEntry {
  done: number;
  total: number;
  status: LocalSendStatus;
}

interface UploadProgressState {
  byFileId: Record<string, UploadProgressEntry | undefined>;
  setTransmissionProgress: (fileId: string, next: UploadProgressEntry) => void;
  clearProgress: (fileId: string) => void;
  clearAll: () => void;
}

export const useUploadProgressStore = create<UploadProgressState>(set => ({
  byFileId: {},
  setTransmissionProgress: (fileId, next) =>
    set(state => ({ byFileId: { ...state.byFileId, [fileId]: next } })),
  clearProgress: fileId =>
    set(state => {
      const next = { ...state.byFileId };
      delete next[fileId];
      return { byFileId: next };
    }),
  clearAll: () => set({ byFileId: {} }),
}));
