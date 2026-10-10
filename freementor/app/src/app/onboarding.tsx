/**
 * Onboarding — product plan §5.
 *
 * One question per screen, a progress bar, a back button, Hinglish-friendly
 * copy. Sign-in happens before this (src/app/sign-in.tsx), so every answer
 * here lands on a known account; the age gate deliberately comes before
 * anything else is stored.
 *
 * The "when & where will you study" step (plan §5 step 8) was removed on the
 * product owner's decision. The reminder time now lives in Profile →
 * Notifications; there is no "where" any more. Do not re-add it here without
 * checking §5, which records the trade-off.
 *
 * Qualification is NOT asked here. Its options come from the catalog and
 * differ by goal — JEE asks Class 10/11/12/Dropper, a programming track asks
 * college/graduated — so it cannot be answered before a goal is picked. It is
 * step 2 of goal/[id].tsx instead, which is also where weekly time and the
 * roadmap build happen.
 */
import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { Button, Card, Pill, ProgressBar, Screen, Txt } from '../components/ui.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { deletePhotoFile, pickProfilePhoto } from '../profile/photo.ts';
import { adPolicyFor, birthYearRange, decideAge, type AgeDecision } from '../onboarding/age.ts';
import { saveProfile } from '../db/profile.ts';
import { requestPermission } from '../notifications/daily.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';

type Step =
  | 'welcome'
  | 'age'
  | 'consent'
  | 'name'
  | 'language'
  | 'notifications'
  | 'done';

const ORDER: Step[] = [
  'welcome',
  'age',
  'consent',
  'name',
  'language',
  'notifications',
  'done',
];

export default function Onboarding() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('welcome');
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [decision, setDecision] = useState<AgeDecision | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [parentContact, setParentContact] = useState('');
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [language, setLanguage] = useState<'en' | 'hi' | 'hi-en'>('en');

  const progress = (ORDER.indexOf(step) + 1) / ORDER.length;

  const choosePhoto = useCallback(async () => {
    setPickingPhoto(true);
    try {
      // Passing the current uri lets the picker replace that file rather than
      // leaving an orphan behind on a second attempt.
      const result = await pickProfilePhoto(photoUri);
      if (result.ok) {
        setPhotoUri(result.uri);
        return;
      }
      if (result.reason === 'permission_denied') {
        Alert.alert(
          'Photo access is off',
          'FreeMentor needs permission to open your gallery. You can turn it on in Android settings — or skip it, the photo is optional.',
        );
      } else if (result.reason === 'failed') {
        Alert.alert('Could not use that photo', 'Try another image.');
      }
    } finally {
      setPickingPhoto(false);
    }
  }, [photoUri]);

  const next = useCallback(
    (from: Step) => {
      if (from === 'welcome') return setStep('age');
      if (from === 'age') {
        // Skip the consent screen for adults.
        return setStep(decision?.outcome === 'needs_parent_consent' ? 'consent' : 'name');
      }
      if (from === 'consent') return setStep('name');
      if (from === 'name') return setStep('language');
      if (from === 'language') return setStep('notifications');
      return setStep('done');
    },
    [decision],
  );

  const back = useCallback(() => {
    const i = ORDER.indexOf(step);
    if (i <= 0) return;
    const previous = ORDER[i - 1]!;
    if (previous === 'consent' && decision?.outcome !== 'needs_parent_consent') {
      setStep('age');
      return;
    }
    setStep(previous);
  }, [step, decision]);

  const finish = useCallback(async () => {
    await saveProfile({
      name: name.trim() || null,
      photoUri,
      birthYear,
      language,
      onboardedAt: new Date().toISOString(),
    });
    router.replace('/choose');
  }, [name, photoUri, birthYear, language, router]);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + theme.spacing.lg, paddingHorizontal: theme.spacing.screen }}>
        <ProgressBar fraction={progress} />
        {step !== 'welcome' ? (
          <Button label="← Back" variant="ghost" onPress={back} style={{ alignSelf: 'flex-start' }} />
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.screen,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        {step === 'welcome' ? (
          <>
            <Txt variant="display">Welcome to FreeMentor.</Txt>
            <Txt variant="body" color="secondary">
              Let's build your roadmap with free, trusted resources. You tell us where you
              want to get to and how much time you have — we'll tell you exactly what to do
              each day.
            </Txt>
            <Button label="Get started" onPress={() => next('welcome')} />
          </>
        ) : null}

        {step === 'age' ? (
          <>
            <Txt variant="display">Which year were you born?</Txt>
            <Txt variant="small" color="secondary">
              Just the year. FreeMentor is for ages 16 and over.
            </Txt>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {birthYearRange().slice(0, 24).map((year) => (
                <Button
                  key={year}
                  label={String(year)}
                  variant={birthYear === year ? 'primary' : 'secondary'}
                  onPress={() => {
                    setBirthYear(year);
                    setDecision(decideAge(year));
                  }}
                  style={{ paddingHorizontal: theme.spacing.lg, minHeight: 44 }}
                />
              ))}
            </View>

            {decision?.outcome === 'blocked' ? (
              <Card style={{ borderLeftWidth: 4, borderLeftColor: theme.colors.accent }}>
                <Txt variant="bodyStrong">We can't continue</Txt>
                <Txt variant="small" color="secondary" style={{ marginTop: 4 }}>
                  {decision.reason}
                </Txt>
              </Card>
            ) : null}

            {decision?.outcome === 'needs_parent_consent' ? (
              <Card>
                <Pill tone="accent">Parent consent needed</Pill>
                <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.sm }}>
                  {decision.reason}
                </Txt>
              </Card>
            ) : null}

            <Button
              label="Continue"
              onPress={() => next('age')}
              disabled={!decision || decision.outcome === 'blocked'}
            />
          </>
        ) : null}

        {step === 'consent' ? (
          <>
            <Txt variant="display">A parent needs to agree</Txt>
            <Txt variant="body" color="secondary">
              We'll send your parent or guardian a note explaining what FreeMentor stores
              and why. Until they agree, we keep only your sign-in.
            </Txt>

            <Card>
              <Txt variant="caption" color="secondary">
                PARENT'S EMAIL OR PHONE
              </Txt>
              <TextInput
                value={parentContact}
                onChangeText={setParentContact}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="parent@example.com"
                placeholderTextColor={theme.colors.muted}
                style={[
                  theme.typography.body,
                  {
                    marginTop: theme.spacing.sm,
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
                label={consentGiven ? 'Declared ✓' : 'I have my parent’s permission'}
                variant={consentGiven ? 'primary' : 'secondary'}
                onPress={() => setConsentGiven(true)}
                style={{ marginTop: theme.spacing.md }}
              />
              <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.sm }}>
                This records what you told us, not your parent's agreement — a code sent
                to them is what verifies it, and that arrives in a coming update. Either
                way you'll only ever see non-personalised, G-rated ads.
              </Txt>
            </Card>

            <Button
              label="Continue"
              onPress={() => next('consent')}
              disabled={!consentGiven || parentContact.trim().length < 5}
            />
          </>
        ) : null}

        {step === 'name' ? (
          <>
            <Txt variant="display">Tell us about you</Txt>
            <Txt variant="small" color="secondary">
              Your name greets you each morning. A photo is optional.
            </Txt>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={theme.colors.muted}
              style={[
                theme.typography.body,
                {
                  minHeight: 48,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                },
              ]}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.lg,
                marginTop: theme.spacing.sm,
              }}
            >
              <Avatar
                uri={photoUri}
                name={name}
                size={64}
                onPress={pickingPhoto ? undefined : () => void choosePhoto()}
              />
              <View style={{ flex: 1, gap: theme.spacing.sm }}>
                <Button
                  compact
                  label={
                    pickingPhoto ? 'Opening…' : photoUri ? 'Change photo' : 'Add a photo'
                  }
                  variant="secondary"
                  onPress={() => void choosePhoto()}
                  disabled={pickingPhoto}
                />
                {photoUri ? (
                  <Button
                    compact
                    label="Remove"
                    variant="ghost"
                    onPress={() => {
                      deletePhotoFile(photoUri);
                      setPhotoUri(null);
                    }}
                  />
                ) : (
                  <Txt variant="caption" color="secondary">
                    Optional. Stays on your device.
                  </Txt>
                )}
              </View>
            </View>
            <Button label="Continue" onPress={() => next('name')} />
          </>
        ) : null}

        {step === 'language' ? (
          <>
            <Txt variant="display">Which language suits you?</Txt>
            <View style={{ gap: theme.spacing.sm }}>
              {(
                [
                  ['en', 'English'],
                  ['hi', 'हिंदी'],
                  ['hi-en', 'Hinglish (both)'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  label={label}
                  variant={language === value ? 'primary' : 'secondary'}
                  onPress={() => setLanguage(value)}
                />
              ))}
            </View>
            <Txt variant="caption" color="secondary">
              This picks your videos and notes where both are available.
            </Txt>
            <Button label="Continue" onPress={() => next('language')} />
          </>
        ) : null}

        {step === 'notifications' ? (
          <>
            <Txt variant="display">Can we nudge you?</Txt>
            <Txt variant="body" color="secondary">
              One reminder a day and your weekly report on Sunday. That's it — never
              more than two a day, and you can turn any of it off later. You pick the
              daily time in Profile → Notifications.
            </Txt>

            <Card>
              <Txt variant="caption" color="secondary">
                WHAT YOU'LL GET
              </Txt>
              <View style={{ marginTop: theme.spacing.sm, gap: 4 }}>
                <Txt variant="small">· "Your Day 12 roadmap is waiting." — once a day, at a time you choose</Txt>
                <Txt variant="small">· "Your weekly report just dropped." — Sundays</Txt>
                <Txt variant="small">· Nothing during your quiet hours</Txt>
              </View>
            </Card>

            <Button
              label="Allow reminders"
              onPress={() => {
                // The OS prompt appears here; a refusal is final and fine.
                void requestPermission().finally(() => next('notifications'));
              }}
            />
            <Button label="Not now" variant="ghost" onPress={() => next('notifications')} />
          </>
        ) : null}

        {step === 'done' ? (
          <>
            <Txt variant="display">
              {name.trim() ? `Nice to meet you, ${name.trim()}.` : 'All set.'}
            </Txt>
            <Txt variant="body" color="secondary">
              Next: pick what you want to learn, and we'll build your day-by-day roadmap.
            </Txt>
            {birthYear && !adPolicyFor(decideAge(birthYear).age).personalised ? (
              <Card>
                <Txt variant="caption" color="secondary">
                  You'll only see non-personalised, G-rated ads.
                </Txt>
              </Card>
            ) : null}
            <Button label="Choose your goal" onPress={() => void finish()} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

