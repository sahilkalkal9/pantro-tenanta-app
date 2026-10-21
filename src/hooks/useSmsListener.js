import { useEffect, useState, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { addToOfflineQueue } from '../slices/offlineSlice';
import { parseTransactionSms, isBankSms, matchTransactionWithPending } from '../utils/smsParser';
import { addToast } from '../slices/uiSlice';

// SMS auto-detection is intentionally disabled.
// Google Play restricts READ_SMS / RECEIVE_SMS / SEND_SMS, and those
// permissions were removed from app.json for policy compliance. This hook
// degrades to a safe no-op so the module still bundles cleanly without the
// native package. To re-enable: install `react-native-get-sms-android`,
// restore the SMS permissions in app.json, and wire the native module here.
let SmsListener = null;
let SmsRetriever = null;
export function useSmsListener() {
  const dispatch = useDispatch();
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const { syncQueue } = useSelector((state) => state.offline);
  
  const requestSmsPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: 'SMS Permission',
          message: 'Pantro needs to read SMS to auto-detect UPI/bank transactions',
          buttonPositive: 'Allow',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('SMS permission error:', err);
      return false;
    }
  }, []);
  
  const startListening = useCallback(async () => {
    if (Platform.OS !== 'android' || !SmsListener) {
      setError('SMS listener only available on Android with react-native-get-sms');
      return;
    }
    
    const hasPermission = await requestSmsPermission();
    if (!hasPermission) {
      setError('SMS permission denied');
      return;
    }
    
    try {
      // Configure filters for bank/UPI SMS
      const options = {
        filter: {
          sender: ['SBI', 'HDFC', 'ICICI', 'AXIS', 'KOTAK', 'YES', 'INDUS', 'FEDERAL', 'PNB', 'BOB', 'CANARA', 'UNION', 'IDFC', 'RBL', 'BANDHAN', 'AU', 'CITI', 'HSBC', 'DBS', 'GPay', 'Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Amazon Pay'],
          body: ['credited', 'debited', 'upi', 'imps', 'neft', 'rtgs', 'transferred', 'sent', 'received'],
        },
      };
      
      await SmsListener.start(options);
      setIsListening(true);
      setError(null);
      
      SmsListener.onSmsReceived = (sms) => {
        handleIncomingSms(sms);
      };
      
      console.log('SMS listener started');
    } catch (err) {
      console.error('Failed to start SMS listener:', err);
      setError(err.message);
    }
  }, [requestSmsPermission]);
  
  const stopListening = useCallback(async () => {
    if (SmsListener && isListening) {
      try {
        await SmsListener.stop();
        setIsListening(false);
        console.log('SMS listener stopped');
      } catch (err) {
        console.error('Failed to stop SMS listener:', err);
      }
    }
  }, [isListening]);
  
  const handleIncomingSms = useCallback((sms) => {
    if (!sms || !sms.body) return;
    
    // Only process bank/UPI SMS
    if (!isBankSms(sms.sender || '')) return;
    
    const transaction = parseTransactionSms(sms.body, sms.date);
    if (!transaction) return;
    
    console.log('Parsed transaction from SMS:', transaction);
    
    // Add to offline queue for backend sync
    dispatch(addToOfflineQueue({
      method: 'POST',
      url: '/tenant/transactions/auto-detect',
      data: {
        ...transaction,
        source: 'sms_auto_detect',
        detectedAt: Date.now(),
      },
    }));
    
    // Show notification to user
    dispatch(addToast({
      type: 'success',
      title: 'Transaction Detected',
      message: `${transaction.type === 'credit' ? 'Received' : 'Sent'} ${transaction.amount} via ${transaction.upiApp || 'UPI'}`,
      duration: 5000,
    }));
    
    // If there's a UTR, try to match with pending payments
    if (transaction.utr) {
      // This would need access to pending payments from state
      // The matching will happen when the queue is processed on backend
    }
  }, []);
  
  useEffect(() => {
    if (Platform.OS === 'android' && SmsListener) {
      // Auto-start if permission already granted
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS)
        .then(granted => {
          if (granted) startListening();
        });
    }
    
    return () => {
      if (isListening) stopListening();
    };
  }, []);
  
  return {
    isListening,
    error,
    startListening,
    stopListening,
    requestSmsPermission,
  };
}

export function useSmsRetriever() {
  const [otp, setOtp] = useState(null);
  const [error, setError] = useState(null);
  
  const startRetriever = useCallback(async () => {
    if (Platform.OS !== 'android' || !SmsRetriever) return;
    
    try {
      setError(null);
      const otp = await SmsRetriever.startSmsRetriever();
      setOtp(otp);
      return otp;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);
  
  const stopRetriever = useCallback(async () => {
    if (SmsRetriever) {
      try {
        await SmsRetriever.stopSmsRetriever();
      } catch (err) {
        console.error('Failed to stop SMS retriever:', err);
      }
    }
  }, []);
  
  useEffect(() => {
    if (SmsRetriever) {
      SmsRetriever.addListener('onSmsReceived', (sms) => {
        // Extract OTP from SMS
        const otpMatch = sms.body?.match(/\b(\d{6})\b/);
        if (otpMatch) {
          setOtp(otpMatch[1]);
        }
      });
    }
    
    return () => {
      if (SmsRetriever) {
        SmsRetriever.removeListener('onSmsReceived');
      }
    };
  }, []);
  
  return {
    otp,
    error,
    startRetriever,
    stopRetriever,
  };
}