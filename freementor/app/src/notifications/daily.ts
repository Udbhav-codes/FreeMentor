/**
 * Daily study reminder — product plan §8.10.
 *
 * Deliberately a LOCAL scheduled notification, not a server push: it works
 * offline, needs no FCM token, and needs no exact-alarm permission (which
 * Play restricts). Server pushes via FCM arrive at M4 for things the device
 * cannot know, like the trial ending.
 *
 * expo-notifications is loaded LAZILY and every call degrades to a no-op.
 * Two reasons, one of which bit us already:
 *   - The module throws at import time inside Expo Go (push was removed from
 *     it in SDK 53). A static import took down the whole onboarding screen,
 *     which then looked like a missing route.
 *   - Reminders are a convenience. A learner who refuses the permission, or
 *     runs somewhere notifications do not exist, must still get a working app.
 *
 * So: nothing here is allowed to throw, and nothing imports it eagerly.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
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

/** Expo Go cannot schedule these; a development build or a release build can. */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import('expo-notifications');

// undefined = not tried yet, null = unavailable here.
let cached: NotificationsModule | null | undefined;
let warned = false;

async function load(): Promise<NotificationsModule | null> {
  if (cached !== undefined) return cached;

  if (isExpoGo) {
    if (!warned) {
      warned = true;
      console.info(
        '[notifications] Skipped in Expo Go — reminders need a development build.',
      );
    }
    cached = null;
    return null;
  }

  try {
    const mod = await import('expo-notifications');
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    cached = mod;
  } catch (error) {
    console.info('[notifications] Unavailable:', error);
    cached = null;
  }
  return cached;
}

/** Whether reminders can work at all here — lets the UI say so honestly. */
export async function notificationsAvailable(): Promise<boolean> {
  return (await load()) !== null;
}

async function ensureChannel(mod: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await mod.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily study reminder',
    importance: mod.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lockscreenVisibility: mod.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Asks only after explaining the value (§5 step 10). A refusal is final and
 * must not be re-prompted.
 */
export async function requestPermission(): Promise<boolean> {
  const mod = await load();
  if (!mod) return false;
  try {
    const current = await mod.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await mod.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Replaces any existing reminder with one that repeats daily at the time the
 * learner chose during onboarding ("If it's 8 pm, I study at my desk").
 * Returns null whenever a reminder could not be set — never throws.
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
  const mod = await load();
  if (!mod) return null;
  if (isQuiet(hour, quietHours)) return null;
  if (!(await requestPermission())) return null;

  try {
    await ensureChannel(mod);
    await cancelDailyReminder();

    const pool = language === 'hi' ? REMINDERS_HI : REMINDERS_EN;
    const body = pool[new Date().getDate() % pool.length]!;

    return await mod.scheduleNotificationAsync({
      content: { title: 'FreeMentor', body, data: { kind: 'daily' } },
      trigger: {
        type: mod.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: CHANNEL_ID,
      },
    });
  } catch (error) {
    console.info('[notifications] Could not schedule the reminder:', error);
    return null;
  }
}

export async function cancelDailyReminder(): Promise<void> {
  const mod = await load();
  if (!mod) return;
  try {
    const scheduled = await mod.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.kind === 'daily')
        .map((n) => mod.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // Nothing to cancel is not a failure.
  }
}
