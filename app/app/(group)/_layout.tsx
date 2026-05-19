import { Stack } from 'expo-router';

export default function GroupStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="create" options={{ title: 'Create Group', headerBackTitle: 'Back' }} />
      <Stack.Screen name="join" options={{ title: 'Join Group', headerBackTitle: 'Back' }} />
    </Stack>
  );
}
