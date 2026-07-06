import { supabase } from '@/lib/supabase';
import { useGroupStore } from '@/store/groupStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  // Prefilled when opened via an invite deep link: otpshare://join?code=ABC123
  const { code: linkCode } = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState((linkCode ?? '').toUpperCase().slice(0, 6));
  const [loading, setLoading] = useState(false);
  const { setGroup, setMembers } = useGroupStore();
  const router = useRouter();

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      Alert.alert('Enter the 6-character invite code');
      return;
    }

    setLoading(true);

    // The join runs server-side: RLS hides groups from non-members, and the
    // edge function also rate-limits invite-code guessing.
    const { data, error } = await supabase.functions.invoke('join-group', {
      body: { code: trimmed },
    });

    if (error || data?.error) {
      let message = data?.error ?? 'Could not join the group. Try again.';
      if (error) {
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) message = body.error;
        } catch {
          // keep default message
        }
      }
      Alert.alert('Could not join', message);
      setLoading(false);
      return;
    }

    const group = data.group;

    // Now that we're a member, RLS lets us read the member list
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
