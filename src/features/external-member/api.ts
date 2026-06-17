import { request } from "@/shared/api";
import type {
  ExternalMembersGetPayload,
  InviteExternalUserRequest,
  InviteExternalUserResponse,
  InviteResultType,
  ReceivedInvitesPayload,
  RespondInvitePayload,
} from "./type";

export const apiGetExternalMembers = (search?: string) => {
  const query = search ? `&search=${encodeURIComponent(search)}` : "";
  return request<ExternalMembersGetPayload>(
    `/app/externals?page=1&size=1000${query}`,
    { method: "GET" },
  );
};

export const apiInviteExternalUser = (data: InviteExternalUserRequest) =>
  request<InviteExternalUserResponse>("/app/externals/invite", {
    method: "POST",
    body: data,
  });

export const apiCancelExternalInvite = (userId: number) =>
  request<void>(`/app/externals/${userId}/invite`, {
    method: "DELETE",
  });

/** 받은 초대 목록 조회 */
export const apiGetReceivedInvites = () =>
  request<ReceivedInvitesPayload>("/app/externals/invites/received", {
    method: "GET",
  });

/** 받은 초대 수락/거절 */
export const apiRespondInvite = (inviteId: string, result: InviteResultType) =>
  request<RespondInvitePayload>(
    `/app/externals/invites/${inviteId}/received/${result}`,
    { method: "PUT" },
  );

/** 외부친구(협력멤버) 삭제 — contactId === userId */
export const apiDeleteExternalContact = (contactId: number) =>
  request<void>(`/app/externals/${contactId}`, { method: "DELETE" });
