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
} from 'react-native';

export default function JoinGroupScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { session } = useAuthStore();
  const { setGroup, setMembers } = useGroupStore();
  const router = useRouter();

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      Alert.alert('Enter the 6-character invite code');
      return;
    }

    setLoading(true);
    const userId = session!.user.id;

    // Look up group by invite code
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', trimmed)
      .single();

    if (groupError || !group) {
      Alert.alert('Invalid code', 'No group found with that invite code.');
      setLoading(false);
      return;
    }

    // Check member count (max 6)
    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', group.id);

    if ((count ?? 0) >= 6) {
      Alert.alert('Group full', 'This group already has 6 members.');
      setLoading(false);
      return;
    }

    // Check not already a member
    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', userId)
      .single();

    if (existing) {
      Alert.alert('Already a member', 'You are already in this group.');
      setLoading(false);
      return;
    }

    // Join
    const { error: joinError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: userId, role: 'member' });

    if (joinError) {
      Alert.alert('Error', joinError.message);
      setLoading(false);
      return;
    }

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
        Ask a family member for their 6-character group invite code and enter it below.
      </Text>

      <Text className="text-sm font-medium text-gray-700 mb-2">Invite code</Text>
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-4 text-center text-2xl tracking-widest text-gray-900 mb-6 font-mono"
        placeholder="ABC123"
        autoCapitalize="characters"
        autoFocus
        maxLength={6}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
      />

      <TouchableOpacity
        className="bg-blue-600 rounded-xl py-4 items-center"
        onPress={handleJoin}
        disabled={loading || code.length < 6}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Join group</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
