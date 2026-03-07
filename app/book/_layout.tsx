import { Stack } from 'expo-router';

export default function BookLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#3ea8ff',
        headerTitleStyle: { fontWeight: '600', color: '#1a1a2e' },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }}
    />
  );
}
