// Custom entry: boots expo-router as usual, then registers the background SMS
// task so it exists both in the normal app and in the headless JS runtime the
// native foreground service starts when an SMS arrives.
import 'expo-router/entry';
import { registerSmsForwardTask } from './lib/smsHeadlessTask';

registerSmsForwardTask();
