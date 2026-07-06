import { registerForPushNotificationsAsync, savePushToken } from '@/lib/notifications';
import { clearActiveGroup, getSMSPermissionStatus, requestSMSPermission } from '@/lib/smsService';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useGroupStore } from '@/store/groupStore';
import { useOTPStore } from '@/store/otpStore';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const { session } = useAuthStore();
  const { setGroup, setMembers } = useGroupStore();
  const { setOTPs } = useOTPStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshPermissionStatus();
    }, [])
  );

  const refreshPermissionStatus = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(status === 'granted');
    setSmsEnabled(await getSMSPermissionStatus());
  };

  const handleEnableNotifications = async () => {
    const token = await registerForPushNotificationsAsync();
    if (token && session) {
      await savePushToken(session.user.id, token);
    }
    await refreshPermissionStatus();
    if (!token) {
      Alert.alert('Notifications unavailable', 'Enable notifications for this app in your device Settings.');
    }
  };

  const handleEnableSMS = async () => {
    const granted = await requestSMSPermission();
    setSmsEnabled(granted);
    if (!granted) {
      Alert.alert('SMS access unavailable', 'Enable SMS permissions for this app in your device Settings.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          await clearActiveGroup();
          setGroup(null);
          setMembers([]);
          setOTPs([]);
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="px-6 pt-12 pb-8">
      <Text className="text-2xl font-bold text-gray-900 mb-8">Settings</Text>

      <Text className="text-xs font-semibold uppercase text-gray-400 mb-3 tracking-wide">
        Account
      </Text>
      <View className="bg-white rounded-xl px-4 py-3 mb-8 shadow-sm">
        <Text className="text-gray-800 font-medium">{session?.user.phone ?? 'Unknown'}</Text>
      </View>

      <Text className="text-xs font-semibold uppercase text-gray-400 mb-3 tracking-wide">
        Permissions
      </Text>
      <View className="bg-white rounded-xl mb-8 shadow-sm overflow-hidden">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
          <View className="flex-1 pr-3">
            <Text className="text-gray-800 font-medium">Push notifications</Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              Get alerted the instant a new OTP arrives
            </Text>
          </View>
          {notificationsEnabled ? (
            <Text className="text-sm font-medium text-green-600">Enabled</Text>
          ) : (
            <TouchableOpacity
              className="bg-blue-600 rounded-lg px-3 py-1.5"
              onPress={handleEnableNotifications}
            >
              <Text className="text-white text-sm font-semibold">Enable</Text>
            </TouchableOpacity>
          )}
        </View>

        {Platform.OS === 'android' && (
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-1 pr-3">
              <Text className="text-gray-800 font-medium">SMS reading</Text>
              <Text className="text-xs text-gray-400 mt-0.5">
                Required to auto-forward OTPs from this phone
              </Text>
            </View>
            {smsEnabled ? (
              <Text className="text-sm font-medium text-green-600">Enabled</Text>
            ) : (
              <TouchableOpacity
                className="bg-blue-600 rounded-lg px-3 py-1.5"
                onPress={handleEnableSMS}
              >
                <Text className="text-white text-sm font-semibold">Enable</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {Platform.OS === 'ios' && (
          <View className="px-4 py-3">
            <Text className="text-xs text-gray-400">
              iOS doesn't allow apps to read SMS automatically. Use "Add OTP manually" on the
              feed screen to share a code you received.
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        className="bg-white rounded-xl px-4 py-3 mb-8 shadow-sm items-center"
        onPress={handleLogout}
      >
        <Text className="text-red-500 font-semibold">Log out</Text>
      </TouchableOpacity>

      <Text className="text-xs text-gray-300 text-center">
        OTPShare v{Constants.expoConfig?.version ?? '1.0.0'}
      </Text>
    </ScrollView>
  );
}
