import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppRegistry } from 'react-native';
import { encryptOTP } from '@/lib/crypto';
import { parseOTP } from '@/lib/otpParser';
import { ACTIVE_GROUP_KEY, ACTIVE_USER_KEY } from '@/lib/smsService';
import { supabase } from '@/lib/supabase';

// Must match the task name the native SmsForwardService requests.
export const SMS_FORWARD_TASK = 'SmsForwardTask';

interface SmsTaskData {
  sender?: string;
  body?: string;
}

/**
 * Runs in a FRESH JS context spun up by the native foreground service when an
 * SMS arrives — even if the app UI is closed. It has no access to the Zustand
 * stores, so it reads the active group/user from AsyncStorage and reuses the
 * exact same parse + encrypt + upload logic the foreground app uses.
 */
async function smsForwardTask(data: SmsTaskData): Promise<void> {
  try {
    const parsed = parseOTP(data?.body ?? '', data?.sender ?? '');
    if (!parsed) return;

    const [groupId, userId] = await Promise.all([
      AsyncStorage.getItem(ACTIVE_GROUP_KEY),
      AsyncStorage.getItem(ACTIVE_USER_KEY),
    ]);
    if (!groupId || !userId) return;

    // The persisted session lives in AsyncStorage; force it to load (and
    // refresh if expired) before the insert so RLS sees an authenticated user.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const encrypted_otp = await encryptOTP(parsed.code, groupId);
    const { error } = await supabase.from('otps').insert({
      group_id: groupId,
      sender_user_id: userId,
      sender_name: parsed.sender,
      encrypted_otp,
    });
    if (error) throw new Error(error.message);

    await supabase.functions.invoke('send-otp-notification', {
      body: { groupId, senderUserId: userId, senderName: parsed.sender },
    });
  } catch (err) {
    console.warn('[SmsForwardTask] failed to forward OTP', err);
  }
}

/**
 * Registers the headless task. Called from the app entry (index.js) so it is
 * available both to the normal app and to the background JS runtime.
 */
export function registerSmsForwardTask(): void {
  AppRegistry.registerHeadlessTask(SMS_FORWARD_TASK, () => smsForwardTask);
}
