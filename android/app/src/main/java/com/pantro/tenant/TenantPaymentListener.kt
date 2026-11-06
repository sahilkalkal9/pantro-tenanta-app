package com.pantro.tenant

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import java.util.regex.Pattern

class TenantPaymentListener : NotificationListenerService() {

    companion object {
        private const val TAG = "TenantPaymentListener"
        const val PREFS_NAME = "pantro_tenant_payment_prefs"
        const val KEY_LAST_RRN = "last_detected_rrn"
        const val KEY_LAST_AMOUNT = "last_detected_amount"
        const val KEY_LAST_APP = "last_detected_app"
        const val KEY_LAST_TIME = "last_detected_timestamp"
        const val KEY_LAST_RAW = "last_detected_raw"

        // Callback hook when React Native module is loaded
        var onPaymentDetectedCallback: ((String, Double, String) -> Unit)? = null

        private val SUPPORTED_PACKAGES = setOf(
            "com.phonepe.app",
            "com.google.android.apps.nbu.paisa.user",
            "net.one97.paytm",
            "com.dreamplug.androidapp",
            "in.org.npci.upiapp",
            "com.whatsapp",
            "com.freecharge.android",
            "com.mobikwik_new",
            "com.snapwork.hdfc",
            "com.csam.icici.bank.imobile",
            "com.sbi.lotusintouch",
            "com.axis.mobile",
            "com.msf.kbank.mobile",
            "com.indusind.mobile",
            "com.indusind.indie",
            "com.bankofbaroda.mconnect",
            "com.pnb.one",
            "com.canarabank.mobility",
            "com.idfcfirstbank.optimus",
            "com.rblbank.mobank",
            "com.federalbank.fedmobile",
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging"
        )
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        val pkgName = sbn.packageName ?: return
        val isPaymentApp = SUPPORTED_PACKAGES.contains(pkgName)
        val isSmsApp = pkgName.contains("messaging") || pkgName.contains("mms") || pkgName.contains("sms")

        if (!isPaymentApp && !isSmsApp) return

        val extras = sbn.notification?.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""

        val combined = "$title $text $bigText".trim()
        if (combined.isEmpty()) return

        // 1. Check for payment debit transaction
        val isDebit = combined.contains("debited", ignoreCase = true) ||
                      combined.contains("paid", ignoreCase = true) ||
                      combined.contains("sent", ignoreCase = true) ||
                      combined.contains("transferred", ignoreCase = true) ||
                      combined.contains("spent", ignoreCase = true) ||
                      combined.contains("payment of", ignoreCase = true) ||
                      combined.contains("payment successful", ignoreCase = true) ||
                      combined.contains("successful", ignoreCase = true)

        val isPureCredit = (combined.contains("credited to", ignoreCase = true) ||
                           combined.contains("received from", ignoreCase = true) ||
                           combined.contains("salary credited", ignoreCase = true)) &&
                           !combined.contains("debited", ignoreCase = true) &&
                           !combined.contains("paid", ignoreCase = true)

        if (!isDebit || isPureCredit) return

        // 2. Extract Amount
        val amount = extractAmount(combined) ?: return

        // 3. Extract 12-Digit RRN / UTR
        val rrn = extractUtr(combined) ?: return

        val appName = resolveAppName(pkgName, combined)

        Log.d(TAG, "Captured tenant payment debit: App=$appName, Amount=$amount, RRN=$rrn")

        // 4. Save to SharedPreferences for instant retrieval on resume
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString(KEY_LAST_RRN, rrn)
            putFloat(KEY_LAST_AMOUNT, amount.toFloat())
            putString(KEY_LAST_APP, appName)
            putLong(KEY_LAST_TIME, System.currentTimeMillis())
            putString(KEY_LAST_RAW, combined.take(250))
            apply()
        }

        // 5. Notify React Native if active
        try {
            onPaymentDetectedCallback?.invoke(rrn, amount, appName)
        } catch (e: Exception) {
            Log.e(TAG, "Callback invocation failed: ${e.message}")
        }
    }

    private fun extractAmount(text: String): Double? {
        val pattern1 = Pattern.compile(
            "(?:Rs\\.?|INR|₹|amount of|debited for|paid|sent)\\s*[:\\-]?\\s*(?:Rs\\.?|INR|₹)?\\s*([0-9,]+(?:\\.[0-9]{1,2})?)",
            Pattern.CASE_INSENSITIVE
        )
        val matcher1 = pattern1.matcher(text)
        if (matcher1.find()) {
            val numStr = matcher1.group(1)?.replace(",", "") ?: return null
            return numStr.toDoubleOrNull()
        }

        val pattern2 = Pattern.compile(
            "(?:Rs\\.?|INR|₹)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)",
            Pattern.CASE_INSENSITIVE
        )
        val matcher2 = pattern2.matcher(text)
        if (matcher2.find()) {
            val numStr = matcher2.group(1)?.replace(",", "") ?: return null
            return numStr.toDoubleOrNull()
        }

        return null
    }

    private fun extractUtr(text: String): String? {
        val pattern = Pattern.compile(
            "(?:UPI(?:/|/DR/|\\s*Ref\\s*(?:No\\.?)?|\\s*UTR\\s*(?:No\\.?)?|\\s*Txn\\s*(?:ID|No\\.?)?)|\\bUTR\\b|\\bRRN\\b|\\bRef(?:erence)?(?:\\s*No\\.?)?|\\bTxn\\s*(?:ID|No\\.?)?|IMPS(?:/|\\s*Ref)?)\\s*[:/\\-]?\\s*(\\d{12})\\b",
            Pattern.CASE_INSENSITIVE
        )
        var matcher = pattern.matcher(text)
        if (matcher.find()) {
            return matcher.group(1)
        }

        // Fallback: look for 12-digit sequence
        val fallbackPattern = Pattern.compile("\\b(\\d{12})\\b")
        matcher = fallbackPattern.matcher(text)
        if (matcher.find()) {
            return matcher.group(1)
        }
        return null
    }

    private fun resolveAppName(pkg: String, text: String): String {
        return when {
            pkg.contains("phonepe") -> "PhonePe"
            pkg.contains("paisa") -> "Google Pay"
            pkg.contains("paytm") -> "Paytm"
            pkg.contains("dreamplug") -> "CRED"
            pkg.contains("upiapp") -> "BHIM"
            text.contains("HDFC", ignoreCase = true) -> "HDFC Bank"
            text.contains("ICICI", ignoreCase = true) -> "ICICI Bank"
            text.contains("SBI", ignoreCase = true) || text.contains("State Bank", ignoreCase = true) -> "SBI"
            text.contains("Axis", ignoreCase = true) -> "Axis Bank"
            text.contains("Kotak", ignoreCase = true) -> "Kotak Bank"
            text.contains("IndusInd", ignoreCase = true) -> "IndusInd Bank"
            text.contains("Baroda", ignoreCase = true) -> "Bank of Baroda"
            text.contains("PNB", ignoreCase = true) -> "PNB"
            text.contains("Canara", ignoreCase = true) -> "Canara Bank"
            else -> "Payment App"
        }
    }
}
