export type CollectionResponse<T> = T[] | { data?: T[] | null } | null | undefined;

export function toCollection<T>(response: CollectionResponse<T>): T[] {
  return Array.isArray(response) ? response : response?.data ?? [];
}
