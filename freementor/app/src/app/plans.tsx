/**
 * Plans — product plan §10.1 and screen 7 of the preview.
 *
 * UI ONLY. Google Play Billing, server-side verification and real coupon
 * validation arrive at M5; the buttons say so rather than pretending.
 *
 * Two rules are visible here and are not negotiable:
 *   - YouTube lessons stay free to open on EVERY plan, and the screen says so
 *     out loud (YouTube API Services policy).
 *   - The strike-through "was" prices are only shown if they were genuinely
 *     charged before (Indian consumer-protection guidance on dark patterns,
 *     §10.4). They are off by default until you confirm they were real.
 */
import { useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Pill, Screen, Txt } from '../components/ui.tsx';
import { isValidCouponCode } from '../billing/coupons.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';

/** Flip on only once these were genuinely the previous prices. */
const SHOW_WAS_PRICES = false;

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: '₹599',
    was: '₹1,299',
    features: [
      'Your full roadmap and daily plan',
      'All YouTube lessons — free to open, always',
      'Notes and tests after a short rewarded ad',
      'Progress, streak and weekly report',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '₹999',
    was: '₹3,999',
    badge: 'Most complete',
    features: [
      'Everything in Basic, plus:',
      'No ads anywhere',
      'Extra notes (OpenStax, Think Python)',
      'Detailed analytics and advanced reports',
      'Full adaptive recalculation',
    ],
  },
] as const;

export default function Plans() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<'basic' | 'premium'>('premium');
  const [coupon, setCoupon] = useState('');

  const applyCoupon = () => {
    const code = coupon.trim().toUpperCase();
    if (!isValidCouponCode(code)) {
      Alert.alert(
        'Check the code',
        'Coupon codes are six letters then three digits, like TOPPER426.',
      );
      return;
    }
    Alert.alert('Not yet connected', 'Coupon checking needs the backend — coming at M5.');
  };

  const plan = PLANS.find((p) => p.id === selected)!;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingTop: insets.top + theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Txt variant="display">Keep your roadmap going</Txt>
          <Txt variant="body" color="secondary">
            Your free 3-day trial covers everything in Basic. YouTube lessons stay free to
            open on every plan, before and after.
          </Txt>
        </View>

        {PLANS.map((option) => {
          const isSelected = option.id === selected;
          return (
            <Card
              key={option.id}
              onPress={() => setSelected(option.id)}
              style={{
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? theme.colors.primary : theme.colors.border,
              }}
            >
              {'badge' in option && option.badge ? (
                <View style={{ marginBottom: theme.spacing.sm }}>
                  <Pill tone="accent">{option.badge}</Pill>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Txt variant="title" style={{ flex: 1 }}>
                  {option.name}
                </Txt>
                {SHOW_WAS_PRICES ? (
                  <Txt
                    variant="small"
                    color="secondary"
                    style={{ textDecorationLine: 'line-through', marginRight: 6 }}
                  >
                    {option.was}
                  </Txt>
                ) : null}
                <Txt variant="title">{option.price}</Txt>
              </View>

              <View style={{ marginTop: theme.spacing.md, gap: 4 }}>
                {option.features.map((feature) => (
                  <Txt key={feature} variant="small" color="secondary">
                    · {feature}
                  </Txt>
                ))}
              </View>
            </Card>
          );
        })}

        <Card>
          <Txt variant="caption" color="secondary">
            COUPON CODE
          </Txt>
          <View
            style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}
          >
            <TextInput
              value={coupon}
              onChangeText={setCoupon}
              autoCapitalize="characters"
              placeholder="TOPPER426"
              placeholderTextColor={theme.colors.muted}
              maxLength={9}
              style={[
                theme.typography.body,
                {
                  flex: 1,
                  minHeight: 48,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
            />
            <Button
              label="Apply"
              variant="secondary"
              onPress={applyCoupon}
              style={{ paddingHorizontal: theme.spacing.lg }}
            />
          </View>
        </Card>

        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={`Get ${plan.name} · ${plan.price}`}
            onPress={() =>
              Alert.alert(
                'Not yet connected',
                'Google Play Billing arrives at M5. Nothing is charged and nothing is unlocked yet.',
              )
            }
          />
          <Button
            label="Restore purchase"
            variant="ghost"
            onPress={() =>
              Alert.alert('Not yet connected', 'Restoring purchases needs Play Billing (M5).')
            }
          />
          <Button label="Not now" variant="ghost" onPress={() => router.back()} />
        </View>

        <Txt variant="caption" color="secondary">
          One-time payment for this roadmap, via Google Play. Lifetime access to the goal you
          buy; switching to a different goal is a new purchase.
        </Txt>
      </ScrollView>
    </Screen>
  );
}
