import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="feed" options={{ title: 'OTP Feed' }} />
      <Tabs.Screen name="group" options={{ title: 'Group' }} />
    </Tabs>
  );
}
