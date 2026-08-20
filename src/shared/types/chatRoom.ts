export interface RoomModelType {
  title: string;
  roomId: string;
  creator: number;
  createdAt: string;
  participants?: ParticipantItemsType[];
  participantDetail?: ParticipantDetailType;
}

export interface ParticipantItemsType {
  userId: string;
  name: string;
  thumbnailProfileUrl: string | null;
  pushEnabled: boolean;
  department?: string | null;
  job?: string | null;
  // 협력멤버 여부 (이름 옆 외부 심볼 표시용 — domain-policy/external-member.md 참조)
  isExternal?: boolean;
  // 클라이언트 derived 플래그 — 멤버목록에 없고 같은 회사도 아닌 외부 미등록 사용자.
  // 서버 isExternal이 비멤버에 대해 false로 내려오는 한계를 보강하기 위해 SidePanel에서 계산.
  isUnregisteredExternal?: boolean;
  // 서버 /participants 응답이 보내주는 메타 (UI 판정 아닌 표시·fallback용)
  email?: string | null;
  companyName?: string | null;
  companyId?: string | null;
  role?: string | null;
  profileUrl?: string | null;
}

export interface ParticipantDetailType extends ParticipantItemsType {
  isExit: boolean;
  /**
   * DM 상대가 회원탈퇴/소속해제로 제거됨 ({BROADCAST|INIT}/MEMBER_REMOVED/DIRECT_MESSAGE 수신 시 true).
   * isExit(자발적 나가기 — 메시지 전송 시 자동초대 가능)와 달리 전송 불가·자동초대 불가 상태.
   * 정책: dm.md §소속해제 시 / §계정 탈퇴 시 — 목록 유지 + 입력창 비활성 + 이전 대화 조회만 가능.
   */
  isRemoved?: boolean;
}
