/**
 * Profile & settings — product plan §8.9.
 *
 * Profile: name, birth year, qualification, goal, language, total hours, streak.
 * Settings: appearance · language · notifications (+ quiet hours) · account
 * (change goal, reset roadmap, export progress, delete account) · privacy · legal.
 *
 * Account deletion is in-app AND must also exist on the web before the Play
 * listing goes live (§16) — it is a Play requirement, not a nicety.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Pill, Row, Screen, Txt } from '../../components/ui.tsx';
import { Avatar } from '../../components/Avatar.tsx';
import { EditProfile } from '../../components/EditProfile.tsx';
import { catalog } from '../../api/library.ts';
import { deletePhotoFile } from '../../profile/photo.ts';
import { useAuth } from '../../auth/AuthContext.tsx';
import { loadProfile, saveProfile, type Profile } from '../../db/profile.ts';
import { resetDatabase } from '../../db/index.ts';
import { libraryBaseUrl } from '../../api/library.ts';
import { cancelDailyReminder, isExpoGo, scheduleDailyReminder } from '../../notifications/daily.ts';
import { useEnrollment } from '../../state/EnrollmentContext.tsx';
import { describeSync, useSync } from '../../state/SyncContext.tsx';
import { useStreak } from '../../state/useStreak.ts';
import { useAppearance, useTheme } from '../../theme/ThemeProvider.tsx';

/** Common study times — one tap rather than a clock dial. */
const REMINDER_HOURS = [6, 7, 8, 9, 16, 17, 18, 19, 20, 21, 22];

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { appearance, setAppearance } = useAppearance();
  const { goal, plan, refresh } = useEnrollment();
  const { session, signOut, usingDevBypass } = useAuth();
  const { syncing, last, sync } = useSync();
  const streak = useStreak();

  const [profile, setProfile] = useState<Profile | null>(null);
  const catalogEntry = goal ? (catalog.goals.find((g) => g.id === goal.goal.id) ?? null) : null;
  const [dailyOn, setDailyOn] = useState(true);
  const [weeklyOn, setWeeklyOn] = useState(true);

  useEffect(() => {
    loadProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  const update = useCallback(async (patch: Partial<Profile>) => {
    await saveProfile(patch);
    setProfile(await loadProfile());
  }, []);

  const hoursStudied = plan ? Math.round((plan.totals.completedMinutes / 60) * 10) / 10 : 0;

  const confirmReset = () =>
    Alert.alert(
      'Reset this roadmap?',
      'Your ticks, ratings and scores for this goal are cleared and the plan starts from today. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetDatabase();
            await refresh();
            router.replace('/choose');
          },
        },
      ],
    );

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'Everything on this device is erased. Once the backend is connected this will also delete your account on the server within 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            await resetDatabase();
            // The photo is a file on disk, so clearing the row is not enough.
            deletePhotoFile(profile?.photoUri);
            await saveProfile({
              name: null,
              birthYear: null,
              qualification: null,
              onboardedAt: null,
              studyHour: null,
              studyPlace: null,
              photoUri: null,
            });
            await cancelDailyReminder();
            await refresh();
            router.replace('/onboarding');
          },
        },
      ],
    );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.screen,
          paddingTop: insets.top + theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
          <Avatar uri={profile?.photoUri} name={profile?.name} size={56} />
          <View style={{ flex: 1 }}>
            <Txt variant="display">{profile?.name ?? 'Profile'}</Txt>
            {goal ? (
              <Txt variant="caption" color="secondary">
                {goal.goal.name}
              </Txt>
            ) : null}
          </View>
        </View>

        <EditProfile profile={profile} goal={catalogEntry} onChange={update} />

        <Card>
          <Txt variant="heading">Your numbers</Txt>
          {profile?.birthYear ? <Row label="Born" value={String(profile.birthYear)} /> : null}
          <Row label="Hours studied" value={`${hoursStudied} h`} />
          <Row label="Current streak" value={`${streak.current} days`} />
          <Row label="Best streak" value={`${streak.best} days`} />
        </Card>

        <Card>
          <Txt variant="heading">Your goal</Txt>
          <Txt variant="body" color="secondary" style={{ marginTop: theme.spacing.sm }}>
            {goal ? `${goal.goal.name} · version ${goal.goal.version}` : 'No goal selected yet.'}
          </Txt>
          {plan ? (
            <Txt variant="caption" color="secondary" style={{ marginTop: 4 }}>
              {plan.totals.contentDays} study days + {plan.totals.reserveDays} days of mocks
              and revision
            </Txt>
          ) : null}
          <Button
            label={goal ? 'Change goal' : 'Choose a goal'}
            variant="secondary"
            onPress={() =>
              goal
                ? Alert.alert(
                    'Change your goal?',
                    'Your current roadmap is archived, not deleted — you can come back to it. A different goal is a separate purchase.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Choose a new goal', onPress: () => router.push('/choose') },
                    ],
                  )
                : router.push('/choose')
            }
            style={{ marginTop: theme.spacing.lg }}
          />
        </Card>

        <Card>
          <Txt variant="heading">Appearance</Txt>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
            {(['light', 'dark', 'system'] as const).map((option) => (
              <Button
                key={option}
                compact
                label={option[0]!.toUpperCase() + option.slice(1)}
                variant={appearance === option ? 'primary' : 'secondary'}
                onPress={() => setAppearance(option)}
                style={{ flex: 1, paddingHorizontal: theme.spacing.sm }}
              />
            ))}
          </View>
        </Card>

        <Card>
          <Txt variant="heading">Notifications</Txt>
          <Toggle
            label="Daily study reminder"
            hint={
              profile?.studyHour != null
                ? `At ${formatHour(profile.studyHour)}`
                : 'Pick a time below'
            }
            value={dailyOn && profile?.studyHour != null}
            onChange={(next) => {
              setDailyOn(next);
              if (next && profile?.studyHour != null) {
                void scheduleDailyReminder({
                  hour: profile.studyHour,
                  language: profile.language,
                });
              } else {
                void cancelDailyReminder();
              }
            }}
          />
          {/* The reminder time is set here rather than during onboarding.
              Without a picker somewhere the toggle above could never do
              anything: scheduleDailyReminder needs an hour, and nothing else
              in the app sets one. */}
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}
          >
            {REMINDER_HOURS.map((hour) => (
              <Button
                key={hour}
                compact
                label={formatHour(hour)}
                variant={profile?.studyHour === hour ? 'primary' : 'secondary'}
                onPress={() => {
                  void (async () => {
                    await update({ studyHour: hour });
                    setDailyOn(true);
                    await scheduleDailyReminder({
                      hour,
                      language: profile?.language ?? 'en',
                    }).catch(() => null);
                  })();
                }}
                style={{ paddingHorizontal: theme.spacing.md }}
              />
            ))}
          </View>
          <Toggle
            label="Weekly report"
            hint="Sundays"
            value={weeklyOn}
            onChange={setWeeklyOn}
          />
          {isExpoGo ? (
            <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.sm }}>
              Reminders don't fire in Expo Go — they work in the installed app.
            </Txt>
          ) : null}
        </Card>

        <Card>
          <Txt variant="heading">Your plan</Txt>
          <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.sm }}>
            You're on the 3-day free trial of Basic. YouTube lessons stay free to open on
            every plan.
          </Txt>
          <Button
            label="See plans"
            variant="secondary"
            onPress={() => router.push('/plans')}
            style={{ marginTop: theme.spacing.lg }}
          />
        </Card>

        <Card>
          <Txt variant="heading">Account</Txt>
          {session?.user?.email ? (
            <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.sm }}>
              Signed in as {session.user.email}
            </Txt>
          ) : null}
          {usingDevBypass ? (
            <Txt variant="caption" color="danger" style={{ marginTop: theme.spacing.sm }}>
              DEV: no account — sign-in was skipped, so nothing syncs and progress
              stays on this phone only.
            </Txt>
          ) : null}
          <Txt variant="caption" color="secondary" style={{ marginTop: 4 }}>
            {describeSync(last)}
          </Txt>
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
            <Button
              label={syncing ? 'Syncing…' : 'Sync now'}
              variant="secondary"
              loading={syncing}
              onPress={() => void sync()}
            />
            <Button
              label="Sign out"
              variant="secondary"
              onPress={() =>
                Alert.alert(
                  'Sign out?',
                  'Your roadmap and progress stay on this phone. Sign back in to sync them.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign out',
                      onPress: async () => {
                        await signOut();
                        router.replace('/sign-in');
                      },
                    },
                  ],
                )
              }
            />
            <Button label="Reset this roadmap" variant="secondary" onPress={confirmReset} />
            <Button
              label="Export my progress"
              variant="secondary"
              onPress={() =>
                Alert.alert(
                  'Not built yet',
                  'Sync is live, but a downloadable export of your progress is still to come.',
                )
              }
            />
            <Button label="Delete my account" variant="ghost" onPress={confirmDelete} />
          </View>
        </Card>

        <Card>
          <Txt variant="heading">About</Txt>
          <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.sm }}>
            FreeMentor links to free, public resources. We never copy or re-host anyone's
            content, and YouTube lessons are never put behind an ad or a paywall.
          </Txt>
          <View style={{ marginTop: theme.spacing.md, gap: 4 }}>
            <Txt variant="caption" color="secondary">
              Privacy policy · Terms · Refund policy · Content policy — added before the
              store listing.
            </Txt>
          </View>
        </Card>

        <Card>
          <Txt variant="caption" color="secondary">
            LIBRARY SOURCE (DEV)
          </Txt>
          <Txt variant="small" style={{ marginTop: 4 }}>
            {libraryBaseUrl}
          </Txt>
          <View style={{ marginTop: theme.spacing.sm }}>
            <Pill>{isExpoGo ? 'Expo Go' : 'Dev build'}</Pill>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        gap: theme.spacing.md,
        marginTop: theme.spacing.sm,
      }}
    >
      <View style={{ flex: 1 }}>
        <Txt variant="body">{label}</Txt>
        {hint ? (
          <Txt variant="caption" color="secondary">
            {hint}
          </Txt>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        thumbColor={theme.colors.surface}
      />
    </View>
  );
}

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}
