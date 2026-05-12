const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// SVG transformer configuration
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter(ext => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
  // Honor the `exports` field in package.json. Required for libraries that
  // ship multiple builds — e.g. `jose` (used transitively by Privy) which
  // would otherwise pick its Node build and try to import `util` / `zlib`.
  unstable_enablePackageExports: true,
  // Prefer browser / react-native variants over the Node variant when an
  // `exports` map provides multiple conditions.
  unstable_conditionNames: ['require', 'import', 'react-native', 'browser'],
};

module.exports = withNativeWind(config, {
  input: './global.css',
  // Absolute path so the config loads correctly regardless of process.cwd()
  // (e.g. when expo-doctor evaluates metro.config.js from a subdirectory).
  configPath: require.resolve('./tailwind.config.js'),
});
