/**
 * Custom entry point.
 *
 * This file runs BEFORE any app code (including lib/supabase.ts, lib/DeviceContext.tsx,
 * and every screen) is imported. Its only job is to install a global JS error handler
 * so that if anything throws during startup — even a synchronous error thrown while a
 * module is being imported — the app shows a readable on-screen message instead of
 * silently crashing with a native "keeps stopping" dialog.
 *
 * React Native's module loader wraps every `require()` call in the currently-registered
 * global error handler, so installing it here, first, lets us catch errors that happen
 * even before the React tree exists (where a React ErrorBoundary cannot help).
 */
import { Alert, I18nManager, Platform } from 'react-native';

// The interface is Persian, but its layout uses an explicit LTR structural
// canvas with `row-reverse` for RTL rows. Forcing Yoga itself to RTL reverses
// those rows a second time on Android and also mirrors physical left/right
// offsets, making icons, buttons and cards land on the wrong side of the APK.
// Keep RTL available for text shaping, reset an older forced-RTL preference,
// and let the app root set its structural direction explicitly.
if (Platform.OS !== 'web') {
  try {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(false);
    I18nManager.swapLeftAndRightInRTL(false);
  } catch (rtlError) {
    // Text direction is also set explicitly on app text; layout degrades safely.
  }
}

// On web keep Persian document semantics/reading order. The rendered #root
// deliberately overrides this to LTR for structural layout; AppText and each
// screen apply RTL to Persian text and row-reverse to Persian-oriented controls.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  try {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'fa';
  } catch (webRtlError) {
    // ignore — web preview degrades gracefully
  }
}

try {
  const ErrorUtilsGlobal = global.ErrorUtils;

  if (ErrorUtilsGlobal && typeof ErrorUtilsGlobal.setGlobalHandler === 'function') {
    ErrorUtilsGlobal.setGlobalHandler((error, isFatal) => {
      const message = (error && error.message) || String(error);
      const stack = (error && error.stack) || '';

      // Always log it, in case a logcat/log viewer is available.
      // eslint-disable-next-line no-console
      console.error('[AppStartupError]', isFatal ? 'FATAL' : 'non-fatal', message, stack);

      try {
        Alert.alert(
          isFatal ? 'برنامه با خطا مواجه شد' : 'خطا',
          `${message}\n\n${stack}`.slice(0, 1800),
          [{ text: 'باشه' }],
          { cancelable: true }
        );
      } catch (alertError) {
        // If even Alert fails, there's nothing more we can safely do here.
      }

      // Intentionally NOT re-throwing / forwarding to the default handler:
      // the default handler for fatal errors terminates the app process,
      // which is exactly the "keeps stopping" crash we're trying to avoid.
      // Showing the message and staying alive (even if the UI is broken)
      // is far more useful for diagnosing the problem.
    });
  }
} catch (setupError) {
  // If installing the handler itself fails, fall through silently —
  // worst case we're back to default behavior.
}

require('expo-router/entry');
