/**
 * The user-initiated rewarded ad, shared by every place that offers one.
 *
 * Always opt-in: a dialog says what the ad unlocks and the learner chooses to
 * watch (AdMob's rewarded-ad policy). Resolves to
 *   'rewarded'    the ad was watched to the end
 *   'unavailable' no ad could be shown; the content opens anyway, because the
 *                 learner is not held responsible for an empty ad network
 *   'declined'    they cancelled, or closed the ad early; nothing opens
 */
import { Alert } from 'react-native';
import {
  ageFromBirthYear,
  getRewardedAds,
  grantsAccess,
  requestOptionsFor,
  type Outcome,
} from './rewarded.ts';
import { loadProfile } from '../db/profile.ts';
import { isExpoGo } from '../notifications/daily.ts';

// One instance for the app. The real one holds a loaded ad worth reusing.
const ads = getRewardedAds(isExpoGo);

export type AdResult = 'rewarded' | 'unavailable' | 'declined';

export function askForAd(copy: {
  title: string;
  body: string;
  /** Shown when this build has no ads at all (Expo Go, no ad unit). */
  notLiveBody: string;
  watch: string;
  openWithoutAd: string;
  cancel: string;
}): Promise<AdResult> {
  return new Promise((resolve) => {
    Alert.alert(
      copy.title,
      ads.available ? copy.body : copy.notLiveBody,
      [
        { text: copy.cancel, style: 'cancel', onPress: () => resolve('declined') },
        {
          text: ads.available ? copy.watch : copy.openWithoutAd,
          onPress: () => {
            void (async () => {
              const age = ageFromBirthYear((await loadProfile())?.birthYear ?? null);
              let outcome: Outcome;
              try {
                outcome = await ads.show(requestOptionsFor(age));
              } catch (error) {
                outcome = {
                  kind: 'unavailable',
                  reason: error instanceof Error ? error.message : 'ad failed',
                };
              }
              if (!grantsAccess(outcome)) resolve('declined');
              else resolve(outcome.kind === 'rewarded' ? 'rewarded' : 'unavailable');
            })();
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve('declined') },
    );
  });
}
