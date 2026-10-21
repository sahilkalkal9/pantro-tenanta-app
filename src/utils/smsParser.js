// Indian bank/UPI SMS parser for transaction detection
// Handles major banks: SBI, HDFC, ICICI, Axis, Kotak, etc.
// Handles UPI apps: GPay, PhonePe, Paytm, BHIM, Amazon Pay

export const SMS_PATTERNS = {
  // Credited/Received patterns
  credited: [
    /(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)\s*(?:credited|received|deposited)/i,
    /(?:credited|received)\s*(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/i,
    /(?:a\/c|account|ac)\s*(?:\w+\s*)?(?:credited|received)\s*(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/i,
  ],
  
  // Debited/Sent patterns
  debited: [
    /(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)\s*(?:debited|sent|paid|transferred)/i,
    /(?:debited|sent|paid)\s*(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/i,
    /(?:a\/c|account|ac)\s*(?:\w+\s*)?(?:debited|sent)\s*(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/i,
  ],
  
  // UTR/Reference patterns
  utr: [
    /(?:upi|imps|neft|rtgs)\/(\d{10,12})/i,
    /(?:ref|reference|utr|txn)\.?\s*(?:no|number|id)?\s*[:\-]?\s*(\d{10,12})/i,
    /(?:txn|transaction)\s*(?:id|ref)\s*[:\-]?\s*(\d{10,12})/i,
  ],
  
  // Sender/Payee patterns
  payee: [
    /(?:from|to)\s+([A-Za-z\s]{3,30})(?:\s+via|\s+on|\s+at|\s*$)/i,
    /(?:paid to|received from)\s+([A-Za-z\s]{3,30})/i,
    /(?:@\w+)(?:\s|$)/i, // UPI handle
  ],
  
  // Bank account patterns
  account: [
    /(?:a\/c|account|ac)\s*(?:no|number)?\s*[:\-]?\s*(\w{4,})/i,
    /(?:ending|ending\s+in)\s+(\d{4})/i,
  ],
  
  // Date/Time patterns
  dateTime: [
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i,
    /(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)/i,
  ],
  
  // Balance patterns
  balance: [
    /(?:bal|balance)\s*(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/i,
    /(?:available\s+bal)\s*(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/i,
  ],
};

export function parseAmount(text) {
  const match = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/i);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return null;
}

export function parseUtr(text) {
  for (const pattern of SMS_PATTERNS.utr) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function parsePayee(text) {
  for (const pattern of SMS_PATTERNS.payee) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

export function parseAccount(text) {
  for (const pattern of SMS_PATTERNS.account) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

export function parseBalance(text) {
  for (const pattern of SMS_PATTERNS.balance) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1].replace(/,/g, ''));
  }
  return null;
}

export function parseDateTime(text) {
  for (const pattern of SMS_PATTERNS.dateTime) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function detectTransactionType(text) {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('debited') || lowerText.includes('sent') || lowerText.includes('paid') || lowerText.includes('transferred')) {
    return 'debit';
  }
  
  if (lowerText.includes('credited') || lowerText.includes('received') || lowerText.includes('deposited')) {
    return 'credit';
  }
  
  return 'unknown';
}

export function detectUpiApp(text) {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('google pay') || lowerText.includes('gpay')) return 'gpay';
  if (lowerText.includes('phonepe') || lowerText.includes('phone pe')) return 'phonepe';
  if (lowerText.includes('paytm')) return 'paytm';
  if (lowerText.includes('bhim')) return 'bhim';
  if (lowerText.includes('amazon pay') || lowerText.includes('amazonpay')) return 'amazonpay';
  
  return 'unknown';
}

export function parseTransactionSms(smsText, smsDate) {
  const type = detectTransactionType(smsText);
  const amount = parseAmount(smsText);
  const utr = parseUtr(smsText);
  const payee = parsePayee(smsText);
  const account = parseAccount(smsText);
  const balance = parseBalance(smsText);
  const dateTime = parseDateTime(smsText);
  const upiApp = detectUpiApp(smsText);
  
  // Only return if we have minimum required info
  if (!amount || type === 'unknown') {
    return null;
  }
  
  return {
    type, // 'credit' or 'debit'
    amount,
    utr,
    payee,
    account,
    balance,
    dateTime: smsDate || dateTime,
    upiApp,
    rawText: smsText,
    parsedAt: Date.now(),
  };
}

export function parseTransactionSmsList(smsList) {
  return smsList
    .map(({ body, date }) => parseTransactionSms(body, date))
    .filter(Boolean);
}

// Helper to match parsed transaction with pending rent/payment
export function matchTransactionWithPending(transaction, pendingItems) {
  if (!transaction.utr) return null;
  
  return pendingItems.find(item => 
    item.utr && item.utr === transaction.utr
  ) || pendingItems.find(item => 
    item.amount === transaction.amount && 
    Math.abs(new Date(item.dueDate || item.date).getTime() - new Date(transaction.dateTime || Date.now()).getTime()) < 86400000 // within 1 day
  ) || null;
}

export const BANK_SMS_SENDERS = [
  'SBI', 'HDFC', 'ICICI', 'AXIS', 'KOTAK', 'YES', 'INDUS', 'FEDERAL',
  'PNB', 'BOB', 'CANARA', 'UNION', 'IDFC', 'RBL', 'BANDHAN', 'AU',
  'CITI', 'STANDARD CHARTERED', 'HSBC', 'DBS', 'IDBI', 'CENTRAL',
  'UCO', 'SYNDICATE', 'ORIENTAL', 'ANDHRA', 'CORPORATION', 'VIJAYA',
  'KARNATAKA', 'SOUTH INDIAN', 'CATHOLIC SYRIAN', 'DHANLAXMI',
  'TAMILNAD MERCANTILE', 'LAKSHMI VILAS', 'KARUR VYSYA', 'CITY UNION',
  'GPay', 'Google Pay', 'PhonePe', 'Phone Pe', 'Paytm', 'BHIM', 'Amazon Pay',
];

export function isBankSms(sender) {
  const upperSender = sender.toUpperCase();
  return BANK_SMS_SENDERS.some(bank => upperSender.includes(bank.toUpperCase()));
}