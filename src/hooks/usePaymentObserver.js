import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import { matchDebitTransaction, parseUtr } from '../utils/smsParser';

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
 * Hook to automatically observe and fetch RRN / UTR from payment debit messages,
 * bank SMS, or clipboard when returning from PhonePe / Google Pay / Paytm.
 */
export function usePaymentObserver({ expectedAmount, onDetected, enabled = true }) {
  const [detectedRrn, setDetectedRrn] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const lastCheckedRef = useRef(0);

  const checkSource = useCallback(async () => {
    if (!enabled || !expectedAmount || Number(expectedAmount) <= 0) return null;

    const now = Date.now();
    // Throttle checks to once every 2 seconds
    if (now - lastCheckedRef.current < 2000) return null;
    lastCheckedRef.current = now;

    setIsDetecting(true);

    try {
      // 1. Check Clipboard (Works reliably on both Android and iOS)
      const clipboard = getClipboardModule();
      if (clipboard?.getStringAsync) {
        try {
          const clipText = await clipboard.getStringAsync();
          if (clipText && typeof clipText === 'string') {
            const cleanDigits = clipText.replace(/\D/g, '');
            // Case A: User copied exactly 12-digit UTR
            if (cleanDigits.length === 12) {
              setDetectedRrn(cleanDigits);
              onDetected?.(cleanDigits, { source: 'clipboard', rawText: clipText });
              return cleanDigits;
            }

            // Case B: User copied bank/UPI receipt text containing amount & UTR
            const matched = matchDebitTransaction(clipText, expectedAmount);
            if (matched && matched.utr) {
              setDetectedRrn(matched.utr);
              onDetected?.(matched.utr, { source: 'clipboard', ...matched });
              return matched.utr;
            }
          }
        } catch (clipErr) {
          console.log('[usePaymentObserver] clipboard read error:', clipErr?.message);
        }
      }

      // 2. Check Android SMS / Notification history if available
      if (Platform.OS === 'android') {
        const SmsAndroid = getSmsModule();
        if (SmsAndroid?.list) {
          try {
            const filter = {
              box: 'inbox',
              maxCount: 5,
            };

            const smsList = await new Promise((resolve) => {
              SmsAndroid.list(
                JSON.stringify(filter),
                (fail) => resolve([]),
                (count, smsList) => {
                  try {
                    resolve(JSON.parse(smsList));
                  } catch {
                    resolve([]);
                  }
                }
              );
            });

            for (const sms of smsList) {
              const matched = matchDebitTransaction(sms.body, expectedAmount);
              if (matched && matched.utr) {
                setDetectedRrn(matched.utr);
                onDetected?.(matched.utr, { source: 'sms', ...matched });
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
        }, 600);
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, checkSource]);

  const resetDetection = () => {
    setDetectedRrn(null);
  };

  return {
    detectedRrn,
    isDetecting,
    checkSource,
    resetDetection,
  };
}
