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
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
