import AddOTPModal from '@/components/AddOTPModal';
import OTPCard from '@/components/OTPCard';
import { decryptOTP } from '@/lib/crypto';
import { requestSMSPermission, setActiveGroup } from '@/lib/smsService';
import { supabase } from '@/lib/supabase';
import { OTP } from '@/lib/types';
import { useAuthStore } from '@/store/authStore';
import { useGroupStore } from '@/store/groupStore';
import { useOTPStore } from '@/store/otpStore';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function FeedScreen() {
  const { session } = useAuthStore();
  const { group } = useGroupStore();
  const { otps, addOTP, removeOTP, setOTPs } = useOTPStore();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);

  useEffect(() => {
    if (!group) return;
    loadInitialOTPs();
    subscribeToOTPs();
    setupBackgroundForwarding();
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [group?.id]);

  // Grants SMS access and records which group/user the native background
  // listener should forward to. The listener keeps running via a foreground
  // service even after this screen unmounts or the app is closed, so there is
  // nothing to tear down here — it is cleared on logout instead.
  const setupBackgroundForwarding = async () => {
    if (Platform.OS !== 'android' || !session) return;
    const granted = await requestSMSPermission();
    if (!granted) return;
    await setActiveGroup(group!.id, session.user.id);
  };

  const decryptAndEnrich = async (raw: any): Promise<OTP> => {
    const otp_code = await decryptOTP(raw.encrypted_otp, group!.id);
    return { ...raw, otp_code };
  };

  const loadInitialOTPs = async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('otps')
      .select('*, profiles:sender_user_id(id, display_name, phone)')
      .eq('group_id', group!.id)
      .gt('expires_at', now)
      .order('received_at', { ascending: false })
      .limit(20);

    if (!data) return;

    const enriched = await Promise.all(
      data.map(async (row) => ({
        ...(await decryptAndEnrich(row)),
        sender_profile: row.profiles,
      }))
    );

    // Attach who has already seen each OTP
    const { data: views } = await supabase
      .from('otp_views')
      .select('otp_id, profiles:viewer_id(display_name, phone)')
      .in('otp_id', enriched.map((o) => o.id));

    const viewersByOtp = new Map<string, string[]>();
    for (const v of (views ?? []) as any[]) {
      const name = v.profiles?.display_name ?? v.profiles?.phone ?? 'Someone';
      viewersByOtp.set(v.otp_id, [...(viewersByOtp.get(v.otp_id) ?? []), name]);
    }

    setOTPs(enriched.map((o) => ({ ...o, viewers: viewersByOtp.get(o.id) ?? [] })));

    // Log views for loaded OTPs
    if (session) {
      const viewRows = enriched.map((o) => ({
        otp_id: o.id,
        viewer_id: session.user.id,
      }));
      await supabase.from('otp_views').upsert(viewRows, { onConflict: 'otp_id,viewer_id', ignoreDuplicates: true });
    }
  };

  const subscribeToOTPs = () => {
    channelRef.current = supabase
      .channel(`otps:${group!.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'otps',
          filter: `group_id=eq.${group!.id}`,
        },
        async (payload) => {
          const raw = payload.new as any;
          // Fetch sender profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name, phone')
            .eq('id', raw.sender_user_id)
            .single();

          const enriched: OTP = {
            ...(await decryptAndEnrich(raw)),
            sender_profile: profile as any ?? undefined,
          };
          addOTP(enriched);

          // Log view
          if (session) {
            await supabase.from('otp_views').upsert(
              [{ otp_id: enriched.id, viewer_id: session.user.id }],
              { onConflict: 'otp_id,viewer_id', ignoreDuplicates: true }
            );
          }
        }
      )
      .subscribe();
  };

  if (!group) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-8">
        <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">No group yet</Text>
        <Text className="text-gray-500 text-center">
          Go to the Group tab to create or join a family group.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-5 pt-12 pb-3 flex-row items-start justify-between">
        <View>
          <Text className="text-2xl font-bold text-gray-900">Live OTPs</Text>
          <Text className="text-sm text-gray-400 mt-0.5">{group.name}</Text>
        </View>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            className="bg-blue-600 rounded-full px-4 py-2 mt-1"
            onPress={() => setAddModalVisible(true)}
          >
            <Text className="text-white font-semibold text-sm">+ Add OTP</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={otps}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OTPCard otp={item} onExpire={removeOTP} />
        )}
        contentContainerClassName="px-5 pb-8"
        ListEmptyComponent={
          <View className="items-center justify-center mt-24">
            <Text className="text-5xl mb-4">🔐</Text>
            <Text className="text-gray-400 text-base text-center">
              Waiting for OTPs…{'\n'}They'll appear here instantly.
            </Text>
          </View>
        }
      />

      {session && (
        <AddOTPModal
          visible={addModalVisible}
          groupId={group.id}
          userId={session.user.id}
          onClose={() => setAddModalVisible(false)}
        />
      )}
    </View>
  );
}
