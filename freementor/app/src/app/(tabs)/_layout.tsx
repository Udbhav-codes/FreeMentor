/**
 * Bottom navigation — product plan §8.1.
 * Roadmap · Progress · Reports · Practice · Profile, current tab navy and bold.
 */
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider.tsx';

const ICONS: Record<string, string> = {
  index: '⌁',
  progress: '◴',
  reports: '▥',
  practice: '✎',
  profile: '☺',
};

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { ...theme.typography.caption },
        tabBarIcon: ({ color, focused }) => (
          <Text style={{ color, fontSize: 18, fontWeight: focused ? '700' : '400' }}>
            {ICONS[route.name] ?? '•'}
          </Text>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Roadmap' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
