/**
 * Firestore Member Repository Implementation
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { MemberRepository, Member, MemberInput } from './member-repository'
import type { PaginatedResult } from './base-repository'

export class FirestoreMemberRepository implements MemberRepository {
  async create(groupId: string, input: MemberInput): Promise<string> {
    const id = crypto.randomUUID()
    const ref = doc(collection(db, 'groups', groupId, 'members'), id)
    await setDoc(ref, {
      name: input.name,
      role: input.role,
      isCurrentUser: input.isCurrentUser ?? false,
      sortOrder: input.sortOrder ?? 0,
    })
    return id
  }

  async update(groupId: string, id: string, input: Partial<MemberInput>): Promise<void> {
    const ref = doc(db, 'groups', groupId, 'members', id)
    await setDoc(ref, input, { merge: true })
  }

  async delete(groupId: string, id: string): Promise<void> {
    const ref = doc(db, 'groups', groupId, 'members', id)
    await deleteDoc(ref)
  }

  async getById(groupId: string, id: string): Promise<Member | null> {
    const ref = doc(db, 'groups', groupId, 'members', id)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const data = snap.data()
    return {
      id: snap.id,
      name: data.name,
      role: data.role,
      isCurrentUser: data.isCurrentUser,
      sortOrder: data.sortOrder,
    }
  }

  async query(groupId: string, options?: { limit?: number }): Promise<PaginatedResult<Member>> {
    const pageSize = options?.limit ?? 50
    const q = query(
      collection(db, 'groups', groupId, 'members'),
      orderBy('sortOrder', 'asc'),
      limit(pageSize)
    )
    const snap = await getDocs(q)
    const members = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        name: data.name,
        role: data.role,
        isCurrentUser: data.isCurrentUser,
        sortOrder: data.sortOrder,
      } as Member
    })
    return { data: members, total: members.length, hasMore: false }
  }

  async getByGroupId(groupId: string): Promise<Member[]> {
    const result = await this.query(groupId)
    return result.data
  }

  async setCurrentUser(groupId: string, memberId: string): Promise<void> {
    // First, get all members
    const members = await this.getByGroupId(groupId)

    // Update each member to set isCurrentUser
    const updates = members.map((m) =>
      this.update(groupId, m.id, { isCurrentUser: m.id === memberId })
    )

    await Promise.all(updates)
  }
}
