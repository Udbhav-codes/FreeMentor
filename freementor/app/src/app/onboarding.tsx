/**
 * Onboarding — product plan §5.
 *
 * One question per screen, a progress bar, a back button, Hinglish-friendly
 * copy. Google sign-in slots in at step 2 when the backend lands (M4); the
 * age gate deliberately comes before anything else is stored.
 */
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Pill, ProgressBar, Screen, Txt } from '../components/ui.tsx';
import { adPolicyFor, birthYearRange, decideAge, type AgeDecision } from '../onboarding/age.ts';
import { saveProfile } from '../db/profile.ts';
import { isExpoGo, requestPermission, scheduleDailyReminder } from '../notifications/daily.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';

type Step =
  | 'welcome'
  | 'age'
  | 'consent'
  | 'name'
  | 'language'
  | 'studytime'
  | 'notifications'
  | 'done';

const ORDER: Step[] = [
  'welcome',
  'age',
  'consent',
  'name',
  'language',
  'studytime',
  'notifications',
  'done',
];

/** Common study times; the picker stays one tap rather than a clock dial. */
const HOURS = [6, 7, 8, 9, 16, 17, 18, 19, 20, 21, 22];
const PLACES = ['At my desk', 'In the library', 'Somewhere else'];

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
  const [language, setLanguage] = useState<'en' | 'hi' | 'hi-en'>('en');
  const [studyHour, setStudyHour] = useState<number | null>(null);
  const [studyPlace, setStudyPlace] = useState<string | null>(null);

  const progress = (ORDER.indexOf(step) + 1) / ORDER.length;

  const next = useCallback(
    (from: Step) => {
      if (from === 'welcome') return setStep('age');
      if (from === 'age') {
        // Skip the consent screen for adults.
        return setStep(decision?.outcome === 'needs_parent_consent' ? 'consent' : 'name');
      }
      if (from === 'consent') return setStep('name');
      if (from === 'name') return setStep('language');
      if (from === 'language') return setStep('studytime');
      if (from === 'studytime') return setStep('notifications');
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
      birthYear,
      language,
      studyHour,
      studyPlace,
      onboardedAt: new Date().toISOString(),
    });
    // A refused permission is not an error — the app works fine without it.
    if (studyHour != null) {
      await scheduleDailyReminder({ hour: studyHour, language }).catch(() => null);
    }
    router.replace('/choose');
  }, [name, birthYear, language, studyHour, studyPlace, router]);

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
                label={consentGiven ? 'Consent recorded ✓' : 'I have my parent’s permission'}
                variant={consentGiven ? 'primary' : 'secondary'}
                onPress={() => setConsentGiven(true)}
                style={{ marginTop: theme.spacing.md }}
              />
              <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.sm }}>
                Verified consent by OTP arrives with the backend. You'll also only ever see
                non-personalised, G-rated ads.
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
            <Txt variant="display">What should we call you?</Txt>
            <Txt variant="small" color="secondary">
              We'll use it to greet you each morning.
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

        {step === 'studytime' ? (
          <>
            <Txt variant="display">When will you usually study?</Txt>
            <Txt variant="small" color="secondary">
              Deciding this in advance roughly doubles the odds you actually do it. We'll
              remind you at that time.
            </Txt>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {HOURS.map((hour) => (
                <Button
                  key={hour}
                  label={formatHour(hour)}
                  variant={studyHour === hour ? 'primary' : 'secondary'}
                  onPress={() => setStudyHour(hour)}
                  style={{ paddingHorizontal: theme.spacing.lg, minHeight: 44 }}
                />
              ))}
            </View>

            <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.sm }}>
              And where?
            </Txt>
            <View style={{ gap: theme.spacing.sm }}>
              {PLACES.map((place) => (
                <Button
                  key={place}
                  label={place}
                  variant={studyPlace === place ? 'primary' : 'secondary'}
                  onPress={() => setStudyPlace(place)}
                />
              ))}
            </View>

            {studyHour != null && studyPlace ? (
              <Card>
                <Txt variant="bodyStrong">
                  If it's {formatHour(studyHour)}, I study {studyPlace.toLowerCase()}.
                </Txt>
                {isExpoGo ? (
                  <Txt variant="caption" color="secondary" style={{ marginTop: 4 }}>
                    Reminders need the installed app — they won't fire in Expo Go.
                  </Txt>
                ) : null}
              </Card>
            ) : null}

            <Button
              label={studyHour == null ? 'Skip for now' : 'Continue'}
              onPress={() => next('studytime')}
            />
          </>
        ) : null}

        {step === 'notifications' ? (
          <>
            <Txt variant="display">Can we nudge you?</Txt>
            <Txt variant="body" color="secondary">
              One reminder at {studyHour == null ? 'your study time' : formatHour(studyHour)},
              and your weekly report on Sunday. That's it — never more than two a day, and
              you can turn any of it off later.
            </Txt>

            <Card>
              <Txt variant="caption" color="secondary">
                WHAT YOU'LL GET
              </Txt>
              <View style={{ marginTop: theme.spacing.sm, gap: 4 }}>
                <Txt variant="small">· "Your Day 12 roadmap is waiting." — once a day</Txt>
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

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}
