/**
 * Plans — product plan §10.1 and screen 7 of the preview.
 *
 * Buying goes through Google Play Billing (billing/playBilling.ts) and is
 * verified by our server before anything unlocks. Coupons are built but
 * switched off for v1 (COUPONS_ENABLED).
 *
 * Two rules are visible here and are not negotiable:
 *   - The feature lists must match what `billing/entitlement.ts` actually
 *     grants. This screen is where money changes hands, so a feature list
 *     describing a different product is the single most expensive kind of
 *     wrong copy — and it WAS wrong between Oct 2026 and this fix, still
 *     advertising "All YouTube lessons — free to open, always" after the
 *     owner had locked them.
 *   - The strike-through "was" prices are only shown if they were genuinely
 *     charged before (Indian consumer-protection guidance on dark patterns,
 *     §10.4). They are off by default until you confirm they were real.
 */
import { useEffect, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Pill, Screen, Txt } from '../components/ui.tsx';
import {
  COUPONS_ENABLED,
  isValidCouponCode,
  normaliseCouponCode,
} from '../billing/coupons.ts';
import { buy, productFor, restorePurchases, type Plan } from '../billing/playBilling.ts';
import { useEnrollment } from '../state/EnrollmentContext.tsx';
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

/**
 * The feature lists are string KEYS, not sentences: this is the purchase
 * screen, and a learner reading the app in Hindi was being sold in English.
 * Numbered keys rather than an array in the catalogue, because the catalogues
 * are typed `Record<StringKey, string>` — which is what makes a missing
 * translation a compile error.
 */
const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: rupees(PRICES.basic),
    was: rupees(PREVIOUS_PRICES.basic),
    features: [
      'plans.basicFeature1',
      'plans.basicFeature2',
      'plans.basicFeature3',
      'plans.basicFeature4',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: rupees(PRICES.premium),
    was: rupees(PREVIOUS_PRICES.premium),
    badge: 'plans.badgeMostComplete',
    features: [
      'plans.premiumFeature1',
      'plans.premiumFeature2',
      'plans.premiumFeature3',
      'plans.premiumFeature4',
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

  const { trial, purchased, refresh } = useEntitlement();
  const { enrollment } = useEnrollment();
  const [busy, setBusy] = useState(false);

  // A purchase whose server call failed last time (no signal, app closed)
  // is still held by Play. Re-send it quietly whenever Plans opens, so it
  // is recorded and acknowledged well inside Play's 3-day refund window.
  useEffect(() => {
    void restorePurchases(enrollment?.id ?? null).then((plan) => {
      if (plan) void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollment?.id]);

  const purchase = async (wanted: Plan) => {
    const product = productFor(wanted, purchased);
    if (!product) return;
    setBusy(true);
    const result = await buy(product, enrollment?.id ?? null);
    setBusy(false);
    if (result.kind === 'bought') {
      await refresh();
      Alert.alert('Unlocked', 'Your plan is active for this roadmap, for life.');
    } else if (result.kind === 'pending') {
      Alert.alert(
        'Payment pending',
        'Google is still confirming your payment. Your plan unlocks as soon as it clears; you do not need to pay again.',
      );
    } else if (result.kind === 'failed') {
      Alert.alert('Purchase not completed', result.message);
    }
  };

  const restore = async () => {
    setBusy(true);
    const plan = await restorePurchases(enrollment?.id ?? null);
    if (plan) await refresh();
    setBusy(false);
    const holding = plan ?? purchased;
    Alert.alert(
      holding ? 'Restored' : 'Nothing to restore',
      holding
        ? `Your ${holding} plan is active on this account.`
        : 'We found no purchase for this Google account. If you paid on another phone, sign in to Play with the same account.',
    );
  };

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
                  <Pill tone="accent">{t(option.badge)}</Pill>
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
                    · {t(feature)}
                  </Txt>
                ))}
              </View>
            </Card>
          );
        })}

        {COUPONS_ENABLED ? (
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
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          {purchased ? (
            <Card>
              <Pill tone="success">{t('plans.youHave', { plan: purchased })}</Pill>
              <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.sm }}>
                {t('plans.lifetime')}
              </Txt>
            </Card>
          ) : null}
          {productFor(selected, purchased) ? (
            <Button
              label={
                purchased === 'basic' && selected === 'premium'
                  ? `Upgrade to Premium · ${rupees(PRICES.upgrade)}`
                  : `Get ${plan.name} · ${plan.price}`
              }
              loading={busy}
              disabled={busy}
              onPress={() => void purchase(selected)}
            />
          ) : null}
          <Button
            label={t('plans.restore')}
            variant="ghost"
            disabled={busy}
            onPress={() => void restore()}
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
