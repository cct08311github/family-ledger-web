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
  create(_groupId: string, _input: CreateInput): Promise<string>
  update(_groupId: string, _id: string, _input: UpdateInput): Promise<void>
  delete(_groupId: string, _id: string): Promise<void>
  getById(_groupId: string, _id: string): Promise<T | null>
  query(_groupId: string, _options?: QueryOptions): Promise<PaginatedResult<T>>
}
