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
import { isValidCouponCode, normaliseCouponCode } from '../billing/coupons.ts';
import {
  FREE_DISCLOSURE,
  PREVIOUS_PRICES,
  PRICES,
  rupees,
  SHOW_PREVIOUS_PRICES,
} from '../billing/pricing.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';
import { useT } from '../i18n/LanguageProvider.tsx';
import { validateCoupon } from '../api/billing.ts';
import { describeTrial } from '../billing/trial.ts';
import { useEntitlement } from '../billing/useEntitlement.ts';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: rupees(PRICES.basic),
    was: rupees(PREVIOUS_PRICES.basic),
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
    price: rupees(PRICES.premium),
    was: rupees(PREVIOUS_PRICES.premium),
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
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<'basic' | 'premium'>('premium');
  const [coupon, setCoupon] = useState('');
  const [checking, setChecking] = useState(false);
  /** The validated discount, as the server resolved it. */
  const [applied, setApplied] = useState<{
    code: string;
    discountPercent: number;
    productId: string;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const { trial, purchased } = useEntitlement();

  const applyCoupon = async () => {
    const code = normaliseCouponCode(coupon);
    // Checked locally first so an obvious typo does not need a round trip.
    if (!isValidCouponCode(code)) {
      setApplied(null);
      setCouponError('Coupon codes are six letters then three digits, like TOPPER426.');
      return;
    }

    setChecking(true);
    setCouponError(null);
    const result = await validateCoupon(code, selected);
    setChecking(false);

    if (!result.ok) {
      setApplied(null);
      setCouponError(result.detail);
      return;
    }
    // The server decides the discount AND which Play product to launch. The
    // app never computes a price — that is what stops a tampered client
    // buying Premium at 90% off it was never given.
    setApplied({
      code: result.code,
      discountPercent: result.discountPercent,
      productId: result.productId,
    });
  };

  const plan = PLANS.find((p) => p.id === selected)!;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.screen,
          paddingTop: insets.top + theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Txt variant="display">{t('plans.title')}</Txt>
          {/* §10.4 asks for clear disclosure of when the trial ends and what
              locks. Stating it here, where the money is, rather than only in
              Profile. */}
          {trial && !purchased ? (
            <Txt variant="small" color={trial.phase === 'expired' ? 'danger' : 'secondary'}>
              {describeTrial(trial)}
              {trial.phase === 'expired'
                ? ` ${t('plans.whatLockedNow')}`
                : `. ${t('plans.whatLocks')}`}
            </Txt>
          ) : null}
          <Txt variant="body" color="secondary">
            {t('plans.youtubeAlways')}
          </Txt>
          <Txt variant="caption" color="secondary">
            {FREE_DISCLOSURE}
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
                {SHOW_PREVIOUS_PRICES ? (
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
              label={checking ? t('plans.couponChecking') : t('plans.couponApply')}
              variant="secondary"
              loading={checking}
              disabled={checking || coupon.trim().length === 0}
              onPress={() => void applyCoupon()}
              style={{ paddingHorizontal: theme.spacing.screen }}
            />
          </View>
          {applied ? (
            <View style={{ marginTop: theme.spacing.sm }}>
              <Pill tone="success">
                {t('plans.couponApplied', {
                  code: applied.code,
                  percent: applied.discountPercent,
                  plan: selected,
                })}
              </Pill>
              <Txt variant="caption" color="secondary" style={{ marginTop: 4 }}>
                {t('plans.appliedAtCheckout')}
              </Txt>
            </View>
          ) : couponError ? (
            <Txt variant="small" color="danger" style={{ marginTop: theme.spacing.sm }}>
              {couponError}
            </Txt>
          ) : null}
        </Card>

        <View style={{ gap: theme.spacing.sm }}>
          {purchased ? (
            <Card>
              <Pill tone="success">{t('plans.youHave', { plan: purchased })}</Pill>
              <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.sm }}>
                {t('plans.lifetime')}
              </Txt>
            </Card>
          ) : (
            <Button
              label={`Get ${plan.name} · ${plan.price}`}
              onPress={() =>
                Alert.alert(
                  'Payment is not connected yet',
                  // Specific about what is missing, rather than "coming
                  // soon": the server side is done and verified, and it is
                  // Google Play Billing that needs a Play Console account and
                  // a development build.
                  applied
                    ? `Everything is ready except Google Play itself. Your code ${applied.code} would launch the ${applied.productId} product. Nothing is charged.`
                    : 'Everything is ready except Google Play itself, which needs a Play Console account. Nothing is charged.',
                )
              }
            />
          )}
          <Button
            label={t('plans.restore')}
            variant="ghost"
            onPress={() =>
              Alert.alert(
                purchased ? 'Already restored' : 'Nothing to restore',
                purchased
                  ? `Your ${purchased} plan is active on this account.`
                  : 'We found no purchase on this account. If you paid on another phone, sign in with the same Google account.',
              )
            }
          />
          <Button label={t('common.notNow')} variant="ghost" onPress={() => router.back()} />
        </View>

        <Txt variant="caption" color="secondary">
          One-time payment for this roadmap, via Google Play. Lifetime access to the goal you
          buy; switching to a different goal is a new purchase.
        </Txt>
      </ScrollView>
    </Screen>
  );
}
