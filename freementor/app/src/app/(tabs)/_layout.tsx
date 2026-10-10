/**
 * Bottom navigation — product plan §8.1, matching the mockup's .nav:
 * 74 dp tall, white, hairline top border, inactive #8A93A6, active navy bold.
 *
 * Roadmap · Progress · Reports · Practice · Profile.
 */
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '../../theme/tokens.ts';
import { useTheme } from '../../theme/ThemeProvider.tsx';

/**
 * Glyph icons rather than an icon font: @expo/vector-icons would add ~1 MB of
 * TTF for five symbols, and §11.4 caps the app at 25 MB.
 */
const ICONS: Record<string, string> = {
  index: '◢',
  progress: '◔',
  reports: '▤',
  practice: '✎',
  profile: '☻',
};

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.navInactive,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 6,
          elevation: 0,
        },
        tabBarLabelStyle: theme.typography.navLabel,
        tabBarIcon: ({ color, focused }) => (
          <View style={{ alignItems: 'center', gap: 3 }}>
            {/* A 3 dp amber bar marks the current tab. The icon and label stay
                navy, so nothing legible depends on amber's low contrast. */}
            <View
              style={{
                height: 3,
                width: 16,
                borderRadius: 2,
                backgroundColor: focused ? theme.colors.accent : 'transparent',
              }}
            />
            <Text style={{ color, fontSize: 18, fontWeight: focused ? '700' : '400' }}>
              {ICONS[route.name] ?? '•'}
            </Text>
          </View>
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
