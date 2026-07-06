import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptOTP } from '@/lib/crypto';
import { supabase } from '@/lib/supabase';
import { PermissionsAndroid, Platform } from 'react-native';

// Keys the native background task (smsHeadlessTask.ts) reads to know where to
// forward incoming OTPs, since it runs without access to the app's stores.
export const ACTIVE_GROUP_KEY = 'otpshare.activeGroupId';
export const ACTIVE_USER_KEY = 'otpshare.activeUserId';

export async function requestSMSPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const perms = [
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    PermissionsAndroid.PERMISSIONS.READ_SMS,
  ];
  // Android 13+ needs runtime notification permission for the foreground-service
  // notification the background listener posts.
  if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
    perms.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  const result = await PermissionsAndroid.requestMultiple(perms);

  return (
    result['android.permission.RECEIVE_SMS'] === 'granted' &&
    result['android.permission.READ_SMS'] === 'granted'
  );
}

export async function getSMSPermissionStatus(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const [receive, read] = await Promise.all([
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS),
  ]);

  return receive && read;
}

/**
 * Tells the background SMS listener which group/user to forward OTPs to.
 * Persisted so it survives the app being killed — the native receiver spins up
 * a fresh JS runtime that only has AsyncStorage to go on.
 */
export async function setActiveGroup(groupId: string, userId: string): Promise<void> {
  await AsyncStorage.multiSet([
    [ACTIVE_GROUP_KEY, groupId],
    [ACTIVE_USER_KEY, userId],
  ]);
}

export async function clearActiveGroup(): Promise<void> {
  await AsyncStorage.multiRemove([ACTIVE_GROUP_KEY, ACTIVE_USER_KEY]);
}

export interface SubmitOTPOptions {
  groupId: string;
  userId: string;
  senderName: string;
  code: string;
}

/**
 * Encrypts and inserts an OTP, then triggers the push notification.
 * Shared by the background Android task and the manual-entry fallback (iOS).
 */
export async function submitOTP({ groupId, userId, senderName, code }: SubmitOTPOptions): Promise<void> {
  const encrypted_otp = await encryptOTP(code, groupId);
  const { error } = await supabase.from('otps').insert({
    group_id: groupId,
    sender_user_id: userId,
    sender_name: senderName,
    encrypted_otp,
  });

  if (error) throw new Error(error.message);

  await supabase.functions.invoke('send-otp-notification', {
    body: { groupId, senderUserId: userId, senderName },
  });
}
