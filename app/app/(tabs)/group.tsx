import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useGroupStore } from '@/store/groupStore';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function GroupScreen() {
  const { session } = useAuthStore();
  const { group, members, setGroup, setMembers } = useGroupStore();
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadGroup();
  }, []);

  const loadGroup = async () => {
    if (!session) return;
    setLoading(true);

    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', session.user.id)
      .limit(1)
      .single();

    if (!membership) {
      setLoading(false);
      return;
    }

    const { data: groupData } = await supabase
      .from('groups')
      .select('*')
      .eq('id', membership.group_id)
      .single();

    if (groupData) setGroup(groupData);

    const { data: memberData } = await supabase
      .from('group_members')
      .select('*, profiles(*)')
      .eq('group_id', membership.group_id);

    if (memberData) setMembers(memberData as any);

    setLoading(false);
  };

  const handleLeaveGroup = () => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('group_members')
            .delete()
            .eq('group_id', group!.id)
            .eq('user_id', session!.user.id);
          setGroup(null);
          setMembers([]);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!group) {
    return (
      <View className="flex-1 bg-white px-6 justify-center">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Your Family Group</Text>
        <Text className="text-gray-500 mb-10">
          Create a group or join an existing one with an invite code.
        </Text>
        <TouchableOpacity
          className="bg-blue-600 rounded-xl py-4 items-center mb-4"
          onPress={() => router.push('/(group)/create')}
        >
          <Text className="text-white font-semibold text-base">Create a group</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="border border-blue-600 rounded-xl py-4 items-center"
          onPress={() => router.push('/(group)/join')}
        >
          <Text className="text-blue-600 font-semibold text-base">Join with invite code</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="px-6 pt-12 pb-8">
      <Text className="text-2xl font-bold text-gray-900 mb-1">{group.name}</Text>
      <View className="flex-row items-center mb-8">
        <Text className="text-gray-500 text-sm mr-2">Invite code:</Text>
        <Text className="font-mono text-base font-semibold text-blue-600 tracking-widest">
          {group.invite_code}
        </Text>
      </View>

      <Text className="text-xs font-semibold uppercase text-gray-400 mb-3 tracking-wide">
        Members ({members.length})
      </Text>

      {members.map((m) => (
        <View
          key={m.id}
          className="flex-row items-center bg-white rounded-xl px-4 py-3 mb-2 shadow-sm"
        >
          <View className="w-9 h-9 rounded-full bg-blue-100 items-center justify-center mr-3">
            <Text className="text-blue-600 font-bold text-sm">
              {(m.profiles.display_name ?? m.profiles.phone ?? '?')[0].toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-800 font-medium">
              {m.profiles.display_name ?? m.profiles.phone}
            </Text>
            {m.user_id === session?.user.id && (
              <Text className="text-xs text-gray-400">You</Text>
            )}
          </View>
          {m.role === 'admin' && (
            <Text className="text-xs text-blue-500 font-medium">Admin</Text>
          )}
        </View>
      ))}

      <TouchableOpacity className="mt-8 items-center" onPress={handleLeaveGroup}>
        <Text className="text-red-500 text-sm">Leave group</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
