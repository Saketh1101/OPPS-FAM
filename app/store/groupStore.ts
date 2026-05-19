import { Group, GroupMember } from '@/lib/types';
import { create } from 'zustand';

interface GroupState {
  group: Group | null;
  members: GroupMember[];
  setGroup: (group: Group | null) => void;
  setMembers: (members: GroupMember[]) => void;
}

export const useGroupStore = create<GroupState>((set) => ({
  group: null,
  members: [],
  setGroup: (group) => set({ group }),
  setMembers: (members) => set({ members }),
}));
