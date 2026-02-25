export interface TagCategoryListType {
  categoryId: number;
  categoryCode: string;
  categoryTitle: string;
  categoryDescription: string;
}

export interface TagListType extends TagCategoryListType {
  tagId: number;
  code: string;
  title: string;
  description: string;
  messageId?: string;
  taggingId?: string;
  taggingAt?: string;
  userId?: string;
}
