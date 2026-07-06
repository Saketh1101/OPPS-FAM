import { useAuthStore } from '@/store/authStore';
import { Redirect } from 'expo-router';

export default function Index() {
  const { session } = useAuthStore();
  return <Redirect href={session ? '/(tabs)/feed' : '/(auth)/login'} />;
}
