import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import { matchDebitTransaction } from '../utils/smsParser';
import {
  getLastDetectedRrn,
  checkNotificationAccess,
  openNotificationSettings,
  subscribePaymentRrn,
  clearLastDetectedRrn,
  isNativeListenerSupported,
} from '../lib/tenantPaymentBridge';

function getClipboardModule() {
  try {
    // eslint-disable-next-line global-require
    return require('expo-clipboard');
  } catch {
    return null;
  }
}

function getSmsModule() {
  try {
    // eslint-disable-next-line global-require
    return require('react-native-get-sms-android');
  } catch {
    return null;
  }
}

/**
 * Hook to automatically observe and fetch RRN / UTR from payment debit notifications,
 * status bar messages, bank SMS, or clipboard when returning from PhonePe / Google Pay / Paytm.
 */
export function usePaymentObserver({ expectedAmount, onDetected, enabled = true }) {
  const [detectedRrn, setDetectedRrn] = useState(null);
  const [detectedMeta, setDetectedMeta] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [hasNotificationAccess, setHasNotificationAccess] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const lastCheckedRef = useRef(0);

  // Check notification listener access on mount
  useEffect(() => {
    if (isNativeListenerSupported) {
      checkNotificationAccess().then(setHasNotificationAccess).catch(() => {});
    }
  }, []);

  const checkSource = useCallback(async () => {
    if (!enabled || !expectedAmount || Number(expectedAmount) <= 0) return null;

    const now = Date.now();
    // Throttle checks to once every 1.5 seconds
    if (now - lastCheckedRef.current < 1500) return null;
    lastCheckedRef.current = now;

    setIsDetecting(true);

    try {
      // 1. Check Native Android Notification Observer (Most accurate & automatic)
      if (isNativeListenerSupported) {
        try {
          const nativeData = await getLastDetectedRrn(expectedAmount, 15);
          if (nativeData && nativeData.rrn) {
            setDetectedRrn(nativeData.rrn);
            setDetectedMeta(nativeData);
            onDetected?.(nativeData.rrn, { source: 'notification', ...nativeData });
            return nativeData.rrn;
          }
        } catch (nativeErr) {
          console.log('[usePaymentObserver] native listener check error:', nativeErr?.message);
        }
      }

      // 2. Check Clipboard (Works reliably on Android & iOS without any permissions)
      const clipboard = getClipboardModule();
      if (clipboard?.getStringAsync) {
        try {
          const clipText = await clipboard.getStringAsync();
          if (clipText && typeof clipText === 'string') {
            const cleanDigits = clipText.replace(/\D/g, '');
            // Case A: User copied exactly 12-digit UTR
            if (cleanDigits.length === 12) {
              const meta = { source: 'clipboard', rrn: cleanDigits, rawText: clipText };
              setDetectedRrn(cleanDigits);
              setDetectedMeta(meta);
              onDetected?.(cleanDigits, meta);
              return cleanDigits;
            }

            // Case B: User copied bank/UPI receipt text containing amount & UTR
            const matched = matchDebitTransaction(clipText, expectedAmount);
            if (matched && matched.utr) {
              const meta = { source: 'clipboard', ...matched };
              setDetectedRrn(matched.utr);
              setDetectedMeta(meta);
              onDetected?.(matched.utr, meta);
              return matched.utr;
            }
          }
        } catch (clipErr) {
          console.log('[usePaymentObserver] clipboard read error:', clipErr?.message);
        }
      }

      // 3. Fallback: Check Android SMS inbox if SMS module available
      if (Platform.OS === 'android') {
        const SmsAndroid = getSmsModule();
        if (SmsAndroid?.list) {
          try {
            const filter = { box: 'inbox', maxCount: 5 };
            const smsList = await new Promise((resolve) => {
              SmsAndroid.list(
                JSON.stringify(filter),
                () => resolve([]),
                (count, rawJson) => {
                  try {
                    resolve(JSON.parse(rawJson));
                  } catch {
                    resolve([]);
                  }
                }
              );
            });

            for (const sms of smsList) {
              const matched = matchDebitTransaction(sms.body, expectedAmount);
              if (matched && matched.utr) {
                const meta = { source: 'sms', ...matched };
                setDetectedRrn(matched.utr);
                setDetectedMeta(meta);
                onDetected?.(matched.utr, meta);
                return matched.utr;
              }
            }
          } catch (smsErr) {
            console.log('[usePaymentObserver] sms read error:', smsErr?.message);
          }
        }
      }
    } finally {
      setIsDetecting(false);
    }

    return null;
  }, [enabled, expectedAmount, onDetected]);

  // Real-time listener for incoming notification event from native module
  useEffect(() => {
    if (!enabled || !isNativeListenerSupported) return;

    const unsubscribe = subscribePaymentRrn((event) => {
      if (!event || !event.rrn) return;
      // If expected amount is set, verify amount matches within 1 rupee
      if (expectedAmount > 0 && event.amount > 0) {
        if (Math.abs(Number(event.amount) - Number(expectedAmount)) > 1.0) {
          return;
        }
      }
      setDetectedRrn(event.rrn);
      setDetectedMeta({ source: 'live_notification', ...event });
      onDetected?.(event.rrn, { source: 'live_notification', ...event });
    });

    return () => {
      unsubscribe?.();
    };
  }, [enabled, expectedAmount, onDetected]);

  // Listen for App State change (when tenant returns from GPay/PhonePe back to Pantro)
  useEffect(() => {
    if (!enabled) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Just returned to foreground — scan for payment message & RRN
        setTimeout(() => {
          checkSource();
        }, 500);
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, checkSource]);

  const resetDetection = () => {
    setDetectedRrn(null);
    setDetectedMeta(null);
    clearLastDetectedRrn().catch(() => {});
  };

  return {
    detectedRrn,
    detectedMeta,
    isDetecting,
    checkSource,
    resetDetection,
    hasNotificationAccess,
    isNativeListenerSupported,
    openNotificationSettings,
  };
}
