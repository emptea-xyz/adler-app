// Polyfills must load before anything else — Solana web3.js, Privy, and the
// Firebase web SDK all depend on these globals.
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import 'fast-text-encoding';
import '@ethersproject/shims';

import 'expo-router/entry';
