/**
 * Daily study reminder — product plan §8.10.
 *
 * Deliberately a LOCAL scheduled notification, not a server push: it works
 * offline, needs no FCM token, and needs no exact-alarm permission (which
 * Play restricts). Server pushes via FCM arrive at M4 for things the device
 * cannot know, like the trial ending.
 *
 * Cap is two per day (§8.10) and nothing fires inside quiet hours.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isQuiet, type QuietHours } from './quiet.ts';

export { isQuiet, type QuietHours };

/** The playful copy from §8.10. Picked by index so it is deterministic. */
const REMINDERS_EN = [
  'Yo 👀 Your roadmap for today is sitting there waiting for you.',
  "You said you'd give me some time today. No pressure… but your roadmap remembers. 😌",
  'Umm… your task is still waiting. 👀 Wanna get that awkward reunion over with?',
];

const REMINDERS_HI = [
  'अरे 👀 आज का रोडमैप आपका इंतज़ार कर रहा है।',
  'आपने आज पढ़ने का वादा किया था… रोडमैप को याद है। 😌',
  'आपका टास्क अब भी बाकी है। 👀 चलिए शुरू करते हैं?',
];

export const CHANNEL_ID = 'daily-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily study reminder',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Asks only after explaining the value (§5 step 10). Returns whether we may
 * post notifications; a refusal is final and must not be re-prompted.
 */
export async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/**
 * Replaces any existing reminder with one that repeats daily at the time the
 * learner chose during onboarding ("If it's 8 pm, I study at my desk").
 */
export async function scheduleDailyReminder({
  hour,
  minute = 0,
  language = 'en',
  quietHours,
}: {
  hour: number;
  minute?: number;
  language?: 'en' | 'hi' | 'hi-en';
  quietHours?: QuietHours;
}): Promise<string | null> {
  if (!(await requestPermission())) return null;
  if (isQuiet(hour, quietHours)) return null;

  await ensureChannel();
  await cancelDailyReminder();

  const pool = language === 'hi' ? REMINDERS_HI : REMINDERS_EN;
  const body = pool[new Date().getDate() % pool.length]!;

  return Notifications.scheduleNotificationAsync({
    content: { title: 'FreeMentor', body, data: { kind: 'daily' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === 'daily')
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}
