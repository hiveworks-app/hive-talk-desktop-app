import { ParticipantItemsType } from '@/shared/types/chatRoom';

export interface CalculateNotReadCountParams {
  readUserIds: string[];
  participants: ParticipantItemsType[];
}

class ReadCountCalculator {
  normalizeUserId(userId: string | number | null | undefined): string {
    if (userId == null) return '';
    return String(userId).trim();
  }

  filterValidReaders(readUserIds: string[], participantIds: Set<string>): string[] {
    return readUserIds
      .map(id => this.normalizeUserId(id))
      .filter(id => id.length > 0 && participantIds.has(id));
  }

  createParticipantIdSet(participants: ParticipantItemsType[]): Set<string> {
    return new Set(participants.map(p => this.normalizeUserId(p.userId)));
  }

  calculateNotReadCount(params: CalculateNotReadCountParams): number {
    const { readUserIds, participants } = params;
    if (!participants || participants.length === 0) return 0;

    const participantIds = this.createParticipantIdSet(participants);
    const validReaders = this.filterValidReaders(readUserIds, participantIds);
    return Math.max(0, participants.length - validReaders.length);
  }

  recalculateForParticipantChange(
    currentReadUserIds: string[],
    participants: ParticipantItemsType[],
  ): { readUserIds: string[]; notReadCount: number } {
    const participantIds = this.createParticipantIdSet(participants);
    const validReadUserIds = this.filterValidReaders(currentReadUserIds, participantIds);
    const notReadCount = Math.max(0, participants.length - validReadUserIds.length);
    return { readUserIds: validReadUserIds, notReadCount };
  }
}

export const readCountCalculator = new ReadCountCalculator();
