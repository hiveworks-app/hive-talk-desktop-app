import { Pagination } from '@/shared/types/pagination';
import { MemberItem } from '@/shared/types/user';

export interface MembersGetPayload {
  items: MemberItem[];
  pagination: Pagination;
}
