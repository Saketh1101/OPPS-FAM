import { encryptOTP } from '@/lib/crypto';
import { parseOTP } from '@/lib/otpParser';
import { supabase } from '@/lib/supabase';
import { PermissionsAndroid, Platform } from 'react-native';

// Lazy require so iOS doesn't crash trying to load the Android-only module
let SmsListener: any = null;
if (Platform.OS === 'android') {
  try {
    SmsListener = require('react-native-android-sms-listener').default;
  } catch (e) {
    console.warn('SMS listener module not available (likely Expo Go)', e);
  }
}

let subscription: { remove: () => void } | null = null;

export async function requestSMSPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    PermissionsAndroid.PERMISSIONS.READ_SMS,
  ]);

  return (
    result['android.permission.RECEIVE_SMS'] === 'granted' &&
    result['android.permission.READ_SMS'] === 'granted'
  );
}

export interface StartListenerOptions {
  groupId: string;
  userId: string;
}

export function startSMSListener({ groupId, userId }: StartListenerOptions): boolean {
  if (Platform.OS !== 'android' || !SmsListener) return false;
  if (subscription) return true; // already listening

  subscription = SmsListener.addListener(async (message: { originatingAddress: string; body: string }) => {
    try {
      const parsed = parseOTP(message.body, message.originatingAddress);
      if (!parsed) return;

      const encrypted_otp = await encryptOTP(parsed.code, groupId);
      const { error } = await supabase.from('otps').insert({
        group_id: groupId,
        sender_user_id: userId,
        sender_name: parsed.sender,
        encrypted_otp,
      });

      if (error) console.warn('Failed to push OTP:', error.message);

      await supabase.functions.invoke('send-otp-notification', {
        body: {
          groupId,
          senderUserId: userId,
          senderName: parsed.sender,
        },
      });
    } catch (err) {
      console.warn('SMS handler error', err);
    }
  });

  return true;
}

export function stopSMSListener() {
  subscription?.remove();
  subscription = null;
}
