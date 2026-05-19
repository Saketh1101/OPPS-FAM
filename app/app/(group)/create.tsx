import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useGroupStore } from '@/store/groupStore';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function CreateGroupScreen() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { session } = useAuthStore();
  const { setGroup, setMembers } = useGroupStore();
  const router = useRouter();

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert('Enter a group name (at least 2 characters)');
      return;
    }

    setLoading(true);
    const userId = session!.user.id;

    // Create group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({ name: trimmed, created_by: userId })
      .select()
      .single();

    if (groupError || !group) {
      Alert.alert('Error', groupError?.message ?? 'Could not create group');
      setLoading(false);
      return;
    }

    // Add creator as admin member
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: userId, role: 'admin' });

    if (memberError) {
      Alert.alert('Error', memberError.message);
      setLoading(false);
      return;
    }

    // Load full member list with profile
    const { data: members } = await supabase
      .from('group_members')
      .select('*, profiles(*)')
      .eq('group_id', group.id);

    setGroup(group);
    setMembers((members as any) ?? []);
    setLoading(false);

    router.replace('/(tabs)/group');
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white px-6 pt-8"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text className="text-gray-600 mb-6">
        Give your family group a name. You'll get a 6-character invite code to share with members.
      </Text>

      <Text className="text-sm font-medium text-gray-700 mb-2">Group name</Text>
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 mb-6"
        placeholder="e.g. Sharma Family"
        autoFocus
        maxLength={40}
        value={name}
        onChangeText={setName}
      />

      <TouchableOpacity
        className="bg-blue-600 rounded-xl py-4 items-center"
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Create group</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
