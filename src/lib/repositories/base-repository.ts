/**
 * Base Repository Interface
 *
 * Defines the contract for all data access operations.
 * Implementations can be swapped (e.g., Firestore, Mock, REST API).
 */

export interface PaginatedResult<T> {
  data: T[]
  total: number
  hasMore: boolean
}

export interface QueryOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

export interface BaseRepository<T, CreateInput, UpdateInput> {
  create(groupId: string, input: CreateInput): Promise<string>
  update(groupId: string, id: string, input: UpdateInput): Promise<void>
  delete(groupId: string, id: string): Promise<void>
  getById(groupId: string, id: string): Promise<T | null>
  query(groupId: string, options?: QueryOptions): Promise<PaginatedResult<T>>
}
