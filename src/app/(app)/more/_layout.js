import { Stack } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';

export default function MoreLayout() {
  const { isDark } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: isDark ? '#070b14' : '#f8fafc' },
      }}
    />
  );
}

