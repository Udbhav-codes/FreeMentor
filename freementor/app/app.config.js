/**
 * Expo config, layered on top of app.json.
 *
 * It is a function rather than more JSON for one reason: google-services.json
 * is git-ignored (CLAUDE.md: no secrets in the repo), so a cloud EAS build
 * cannot find it on disk. EAS provides it as a file-type environment variable
 * (`GOOGLE_SERVICES_JSON`); locally it falls back to the file beside this one.
 *
 *   eas env:create --name GOOGLE_SERVICES_JSON --type file \
 *     --value ./google-services.json --visibility sensitive \
 *     --environment production --environment preview --environment development
 */
// Google's public sample AdMob App ID. The SDK crashes the app at launch if no
// App ID is set, so a build without the real one still needs this. Replace it
// by setting EXPO_PUBLIC_ADMOB_APP_ID in EAS once the AdMob account exists.
const TEST_ADMOB_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

// REMINDER: the 3-day trial is switched off for testing (src/billing/trial.ts,
// TRIAL_ENABLED). A production build must not ship without it: the listing,
// the Plans screen and the Terms all promise it. This stops `eas build
// --profile production` until the flag is back to true.
const trialSource = require('fs').readFileSync(
  require('path').join(__dirname, 'src/billing/trial.ts'),
  'utf8',
);
if (
  process.env.EAS_BUILD_PROFILE === 'production' &&
  /export const TRIAL_ENABLED = false/.test(trialSource)
) {
  throw new Error(
    'The 3-day free trial is OFF (src/billing/trial.ts: TRIAL_ENABLED = false). ' +
      'Turn it back on before a production build.',
  );
}

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
  plugins: [
    ...(config.plugins ?? []),
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: process.env.EXPO_PUBLIC_ADMOB_APP_ID || TEST_ADMOB_APP_ID,
        // Consent (UMP) runs before the first ad request; measurement waits
        // for it rather than starting at launch.
        delayAppMeasurementInit: true,
      },
    ],
  ],
});
