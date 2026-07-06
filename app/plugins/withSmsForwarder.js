const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RECEIVER_NAME = '.SmsReceiver';
const SERVICE_NAME = '.SmsForwardService';
const KOTLIN_FILES = ['SmsReceiver.kt', 'SmsForwardService.kt'];

/**
 * Adds the SMS broadcast receiver and the foreground service to the manifest.
 */
function addSmsComponents(androidManifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

  application.receiver = application.receiver || [];
  const hasReceiver = application.receiver.some(
    (r) => r.$?.['android:name'] === RECEIVER_NAME
  );
  if (!hasReceiver) {
    application.receiver.push({
      $: {
        'android:name': RECEIVER_NAME,
        'android:enabled': 'true',
        'android:exported': 'true',
        'android:permission': 'android.permission.BROADCAST_SMS',
      },
      'intent-filter': [
        {
          $: { 'android:priority': '999' },
          action: [{ $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' } }],
        },
      ],
    });
  }

  application.service = application.service || [];
  const hasService = application.service.some(
    (s) => s.$?.['android:name'] === SERVICE_NAME
  );
  if (!hasService) {
    application.service.push({
      $: {
        'android:name': SERVICE_NAME,
        'android:enabled': 'true',
        'android:exported': 'false',
        'android:foregroundServiceType': 'dataSync',
      },
    });
  }

  return androidManifest;
}

/**
 * Copies the Kotlin sources into the app package during prebuild, stamping the
 * real application package into their `package` declaration.
 */
function withKotlinSources(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android?.package;
      if (!pkg) {
        throw new Error('withSmsForwarder: expo.android.package must be set in app.json');
      }

      const destDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...pkg.split('.')
      );
      fs.mkdirSync(destDir, { recursive: true });

      const srcDir = path.join(cfg.modRequest.projectRoot, 'plugins', 'android');
      for (const file of KOTLIN_FILES) {
        const template = fs.readFileSync(path.join(srcDir, file), 'utf8');
        fs.writeFileSync(path.join(destDir, file), template.replace(/__PACKAGE__/g, pkg));
      }

      return cfg;
    },
  ]);
}

module.exports = function withSmsForwarder(config) {
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = addSmsComponents(cfg.modResults);
    return cfg;
  });
  config = withKotlinSources(config);
  return config;
};
