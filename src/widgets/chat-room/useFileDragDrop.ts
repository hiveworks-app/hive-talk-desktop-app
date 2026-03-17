import { useCallback, useRef, useState } from 'react';
import type { PendingFileItem } from './FileConfirmDialog';

interface UseFileDragDropOptions {
  onMediaSend: (files: File[]) => void;
  onDocSend: (files: File[]) => void;
}

export function useFileDragDrop({ onMediaSend, onDocSend }: UseFileDragDropOptions) {
  const [pendingItems, setPendingItems] = useState<PendingFileItem[]>([]);
  const dragCounterRef = useRef(0);

  const handleFilesSelected = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const items = files.map(file => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
    setPendingItems(items);
  }, []);

  const clearPendingItems = useCallback(() => {
    setPendingItems(prev => {
      prev.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
      return [];
    });
  }, []);

  const handleFileConfirm = useCallback(() => {
    const files = pendingItems.map(item => item.file);
    const mediaFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const docFiles = files.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/'));
    if (mediaFiles.length > 0) onMediaSend(mediaFiles);
    if (docFiles.length > 0) onDocSend(docFiles);
    clearPendingItems();
  }, [pendingItems, onMediaSend, onDocSend, clearPendingItems]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
  }, [handleFilesSelected]);

  return {
    pendingItems,
    clearPendingItems,
    handleFileConfirm,
    handleFilesSelected,
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  };
}
