const fs = require('fs');
const path = require('path');

// Postinstall patches for known iOS-side Expo SDK incompatibilities. Each
// target is `existsSync`-guarded so the script stays a no-op when a package
// isn't installed.

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
    'expo-camera',
    'ios',
    'Common',
    'CameraPermissionsRequester.swift'
  ),
];

let changed = false;

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
