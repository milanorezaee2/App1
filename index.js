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

// This is a Persian (Farsi) app — its UI is always RTL regardless of the
// phone's system language. Setting it here, at the very top of the entry file,
// makes sure it runs before ANY other module so the direction is applied
// from the very first frame.
try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} catch (rtlError) {
  // Fall through silently — the layout wrapper in app/_layout.tsx also
  // forces RTL visually via `direction: 'rtl'`.
}

// On web, `direction: 'rtl'` in StyleSheet is not supported by react-native-web,
// so set the DOM direction globally instead — the whole tree inherits it.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  try {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'fa';
  } catch (webRtlError) {
    // ignore — web preview degrades gracefully
  }
}

// Mobile resolution emulation for web preview (390x844 iPhone frame on desktop)
// - Desktop (>=520px): centered phone frame with notch & shadow, dark background
// - Real mobile (<520px): full-screen without frame to keep native UX
// - Adds toggle button to switch frame on/off (persisted in localStorage)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  try {
    const mobileStyle = document.createElement('style');
    mobileStyle.id = 'app-mobile-frame';
    mobileStyle.textContent = `
      @media (min-width: 520px) {
        html:not(.arena-frame-disabled), body:not(.arena-frame-disabled) {
          background: #0f172a !important;
          background-color: #0f172a !important;
          display: flex !important;
          justify-content: center !important;
          align-items: flex-start !important;
          min-height: 100vh !important;
          margin: 0 !important;
          padding: 18px 0 60px 0 !important;
          overflow-y: auto !important;
        }
        html:not(.arena-frame-disabled) #root,
        body:not(.arena-frame-disabled) #root {
          width: 390px !important;
          height: 844px !important;
          max-width: 390px !important;
          max-height: 844px !important;
          min-height: 844px !important;
          flex: none !important;
          border-radius: 32px !important;
          overflow: hidden !important;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6), 0 0 0 8px #1e293b, 0 0 0 9px #334155 !important;
          position: relative !important;
          background: #f6f8fb !important;
        }
        html:not(.arena-frame-disabled) #root::before {
          content: '';
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 92px;
          height: 26px;
          background: #0f172a;
          border-radius: 9999px;
          z-index: 9999;
          pointer-events: none;
        }
        html:not(.arena-frame-disabled) body::after {
          content: '📱 390 × 844 — نمایش موبایل';
          position: fixed;
          bottom: 14px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(15,23,42,0.92);
          color: #e2e8f0;
          font-family: Vazirmatn, system-ui, sans-serif;
          font-size: 12px;
          padding: 6px 14px;
          border-radius: 9999px;
          z-index: 10000;
          pointer-events: none;
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          direction: rtl;
        }
      }
      @media (max-width: 519px) {
        html, body {
          background: #f6f8fb !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        #root {
          width: 100% !important;
          height: 100% !important;
          min-height: 100vh !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
      }
      @media (min-width: 520px) {
        #arena-frame-toggle {
          position: fixed;
          top: 12px;
          left: 12px;
          z-index: 10001;
          background: rgba(255,255,255,0.96);
          color: #0f172a;
          border: 1px solid #e2e8f0;
          border-radius: 9999px;
          padding: 7px 14px;
          font-family: Vazirmatn, system-ui, sans-serif;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
          direction: rtl;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }
        #arena-frame-toggle:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.22);
        }
      }
      @media (max-width: 519px) {
        #arena-frame-toggle { display: none !important; }
      }
      html.arena-frame-disabled, html.arena-frame-disabled body {
        background: #f6f8fb !important;
        display: block !important;
        padding: 0 !important;
      }
      html.arena-frame-disabled #root {
        width: 100% !important;
        max-width: 100% !important;
        height: 100% !important;
        min-height: 100vh !important;
        max-height: none !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      html.arena-frame-disabled #root::before { display: none !important; }
      html.arena-frame-disabled body::after { display: none !important; }
    `;
    document.head.appendChild(mobileStyle);

    // Toggle button logic (persisted)
    try {
      const KEY = 'arena-mobile-frame-disabled';
      const isDisabled = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();
      if (isDisabled) document.documentElement.classList.add('arena-frame-disabled');
      const onReady = () => {
        if (document.getElementById('arena-frame-toggle')) return;
        const btn = document.createElement('button');
        btn.id = 'arena-frame-toggle';
        const updateLabel = () => {
          const disabled = document.documentElement.classList.contains('arena-frame-disabled');
          btn.textContent = disabled ? '📱 حالت موبایل' : '🖥️ حالت دسکتاپ (تمام عرض)';
        };
        btn.addEventListener('click', () => {
          const html = document.documentElement;
          html.classList.toggle('arena-frame-disabled');
          const nowDisabled = html.classList.contains('arena-frame-disabled');
          try { localStorage.setItem(KEY, nowDisabled ? '1' : '0'); } catch {}
          updateLabel();
        });
        updateLabel();
        // Wait for body to exist
        if (document.body) document.body.appendChild(btn);
        else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(btn));
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
      else onReady();
    } catch {}
  } catch (e) {
    // ignore
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
