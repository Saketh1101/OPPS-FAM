import { registerForPushNotificationsAsync, savePushToken } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import '../global.css';

export default function RootLayout() {
  const { session, setSession } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;

    let cancelled = false;

    const registerDevice = async () => {
      const pushToken = await registerForPushNotificationsAsync();
      if (!pushToken || cancelled) return;
      await savePushToken(session.user.id, pushToken);
    };

    registerDevice();

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/feed');
    }
  }, [session, segments]);

  return (
    <>
      <StatusBar style="auto" />
      <Slot />
    </>
  );
}
