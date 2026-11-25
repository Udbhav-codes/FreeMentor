/**
 * The trial-ending reminder — product plan §10.4: "reminder notification 24 h
 * before trial ends".
 *
 * Pure planning only (when, whether, and what it says). Scheduling lives in
 * daily.ts beside the other local notifications, because it needs the same
 * lazily loaded, never-throwing expo-notifications module.
 *
 * It is a LOCAL notification on purpose: it works offline and needs no push
 * token. It is set once the trial's end is known and cancelled the moment a
 * plan is bought, so nobody is told their trial is ending after they paid.
 */
import { PRICES, rupees } from '../billing/pricing.ts';
import { REMIND_BEFORE_MS } from '../billing/trial.ts';

export type ReminderLanguage = 'en' | 'hi' | 'hi-en';

/** When to notify: 24 h before the end, or null if that moment has passed. */
export function trialReminderTime(endsAtIso: string, now: Date): Date | null {
  const ends = new Date(endsAtIso).getTime();
  if (Number.isNaN(ends)) return null;
  const at = ends - REMIND_BEFORE_MS;
  // A reminder for a moment already gone would fire at once, which is a
  // surprise rather than a reminder. The welcome card covers that window.
  return at > now.getTime() ? new Date(at) : null;
}

export type TrialReminderPlan =
  | { kind: 'schedule'; at: Date }
  | { kind: 'cancel' };

/** Schedule while the trial runs and nothing is bought; cancel otherwise. */
export function planTrialReminder(input: {
  endsAt: string | null;
  now: Date;
  purchased: 'basic' | 'premium' | null;
}): TrialReminderPlan {
  if (input.purchased || !input.endsAt) return { kind: 'cancel' };
  const at = trialReminderTime(input.endsAt, input.now);
  return at ? { kind: 'schedule', at } : { kind: 'cancel' };
}

/**
 * What it says. §10.4 asks for the end, the price and what locks to be clear,
 * so the body carries all three in one short message.
 */
export function trialReminderCopy(language: ReminderLanguage): { title: string; body: string } {
  const basic = rupees(PRICES.basic);
  switch (language) {
    case 'hi':
      return {
        title: 'आपका मुफ़्त ट्रायल कल ख़त्म हो रहा है',
        body: `उसके बाद वीडियो और नोट्स एक छोटे विज्ञापन के बाद खुलेंगे और अभ्यास व टेस्ट बंद हो जाएँगे। Basic ${basic}, एक बार का भुगतान।`,
      };
    case 'hi-en':
      return {
        title: 'Aapka free trial kal khatam ho raha hai',
        body: `Uske baad videos aur notes ek chhote ad ke baad khulenge aur practice aur tests lock ho jaayenge. Basic ${basic}, ek baar ka payment.`,
      };
    default:
      return {
        title: 'Your free trial ends tomorrow',
        body: `After that, videos and notes open after a short ad and practice and tests lock. Basic is ${basic}, one-time.`,
      };
  }
}
