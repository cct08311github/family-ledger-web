/**
 * Member Repository Interface
 *
 * Defines the contract for member data access.
 */

import type { BaseRepository } from './base-repository'

export interface Member {
  id: string
  name: string
  role: 'owner' | 'member'
  isCurrentUser: boolean
  sortOrder: number
}

export interface MemberInput {
  name: string
  role: 'owner' | 'member'
  isCurrentUser?: boolean
  sortOrder?: number
}

export type MemberRepository = BaseRepository<Member, MemberInput, Partial<MemberInput>> & {
  getByGroupId(_groupId: string): Promise<Member[]>
  setCurrentUser(_groupId: string, _memberId: string): Promise<void>
}
