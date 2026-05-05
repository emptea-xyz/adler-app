// Polyfills must load before anything else — Solana web3.js, Privy, and the
// Firebase web SDK all depend on these globals. Order is significant: every
// non-import line below must run between the polyfill imports and the app
// boot, so we deliberately interleave them and silence the import/first lint.
/* eslint-disable import/first */
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import 'fast-text-encoding';
import '@ethersproject/shims';

import 'expo-router/entry';
/* eslint-enable import/first */
