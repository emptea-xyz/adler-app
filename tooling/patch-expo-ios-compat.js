const fs = require('fs');
const path = require('path');

function patchFile(target, label, replacer) {
  if (!fs.existsSync(target)) {
    console.log(`[${label}] Skipped: file not found`);
    return false;
  }

  const original = fs.readFileSync(target, 'utf8');
  const patched = replacer(original);

  if (patched === original) {
    console.log(`[${label}] No changes needed`);
    return false;
  }

  fs.writeFileSync(target, patched, 'utf8');
  console.log(`[${label}] Patched ${path.basename(target)}`);
  return true;
}

const notificationsBadgeTarget = path.join(
  process.cwd(),
  'node_modules',
  'expo-notifications',
  'ios',
  'ExpoNotifications',
  'Badge',
  'BadgeModule.swift'
);

const rctFatalTargets = [
  path.join(
    process.cwd(),
    'node_modules',
    'expo-image-picker',
    'ios',
    'ImagePickerPermissionRequesters.swift'
  ),
  path.join(
    process.cwd(),
    'node_modules',
    'expo-audio',
    'ios',
    'AudioRecordingRequester.swift'
  ),
  path.join(
    process.cwd(),
    'node_modules',
    'expo-camera',
    'ios',
    'Common',
    'CameraPermissionsRequester.swift'
  )
];

let changed = false;

changed =
  patchFile(notificationsBadgeTarget, 'patch-expo-notifications-badge', (source) => {
    let patched = source;
    patched = patched.replaceAll(
      'return RCTSharedApplication()?.applicationIconBadgeNumber ?? 0',
      'return UIApplication.shared.applicationIconBadgeNumber'
    );
    patched = patched.replaceAll(
      'RCTSharedApplication()?.applicationIconBadgeNumber = badgeCount',
      'UIApplication.shared.applicationIconBadgeNumber = badgeCount'
    );

    // Correct earlier broad replacements if they were already applied.
    patched = patched.replaceAll(
      'return UIApplication.shared.applicationIconBadgeNumber ?? 0',
      'return UIApplication.shared.applicationIconBadgeNumber'
    );
    return patched;
  }) || changed;

for (const target of rctFatalTargets) {
  const label = `patch-rctfatal-${path.basename(target)}`;
  changed =
    patchFile(target, label, (source) => {
      let patched = source;
      patched = patched.replaceAll('RCTFatal(RCTErrorWithMessage(', 'NSLog(');
      patched = patched.replaceAll('"""))', '""")');
      return patched;
    }) || changed;
}

if (!changed) {
  console.log('[patch-expo-ios-compat] No changes needed');
}
