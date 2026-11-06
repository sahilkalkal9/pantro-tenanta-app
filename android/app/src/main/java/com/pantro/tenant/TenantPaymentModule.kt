package com.pantro.tenant

import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.math.abs

class TenantPaymentModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val MODULE_NAME = "TenantPaymentModule"
    }

    override fun getName(): String = MODULE_NAME

    override fun initialize() {
        super.initialize()
        TenantPaymentListener.onPaymentDetectedCallback = { rrn, amount, appName ->
            try {
                val params = Arguments.createMap().apply {
                    putString("rrn", rrn)
                    putDouble("amount", amount)
                    putString("appName", appName)
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                }
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("onPaymentRrnDetected", params)
            } catch (e: Exception) {
                // Ignore if JS context not ready
            }
        }
    }

    @ReactMethod
    fun isNotificationAccessGranted(promise: Promise) {
        try {
            val enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(reactContext)
            val isEnabled = enabledPackages.contains(reactContext.packageName)
            promise.resolve(isEnabled)
        } catch (e: Exception) {
            promise.reject("ERROR_CHECKING_PERMISSION", e.message, e)
        }
    }

    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_OPENING_SETTINGS", e.message, e)
        }
    }

    @ReactMethod
    fun getLastDetectedRrn(expectedAmount: Double, maxAgeMinutes: Int, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(TenantPaymentListener.PREFS_NAME, Context.MODE_PRIVATE)
            val rrn = prefs.getString(TenantPaymentListener.KEY_LAST_RRN, null)
            val amount = prefs.getFloat(TenantPaymentListener.KEY_LAST_AMOUNT, 0f).toDouble()
            val timestamp = prefs.getLong(TenantPaymentListener.KEY_LAST_TIME, 0L)
            val appName = prefs.getString(TenantPaymentListener.KEY_LAST_APP, "Payment App") ?: "Payment App"
            val raw = prefs.getString(TenantPaymentListener.KEY_LAST_RAW, "") ?: ""

            if (rrn.isNullOrEmpty() || timestamp == 0L) {
                promise.resolve(null)
                return
            }

            // Check age (default 15 minutes)
            val effectiveMaxAge = if (maxAgeMinutes > 0) maxAgeMinutes else 15
            val ageMs = System.currentTimeMillis() - timestamp
            if (ageMs > effectiveMaxAge * 60 * 1000) {
                promise.resolve(null)
                return
            }

            val map = Arguments.createMap().apply {
                putString("rrn", rrn)
                putDouble("amount", amount)
                putString("appName", appName)
                putDouble("timestamp", timestamp.toDouble())
                putString("rawText", raw)
            }

            // If expectedAmount is specified (>0), check if amount matches within 1 rupee
            if (expectedAmount > 0) {
                val matches = abs(amount - expectedAmount) <= 1.0
                map.putBoolean("isAmountMatched", matches)
                if (!matches) {
                    // Stored debit amount does not match payable rent
                    promise.resolve(null)
                    return
                }
            } else {
                map.putBoolean("isAmountMatched", true)
            }

            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("ERROR_GETTING_LAST_RRN", e.message, e)
        }
    }

    @ReactMethod
    fun clearLastDetectedRrn(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(TenantPaymentListener.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().apply {
                remove(TenantPaymentListener.KEY_LAST_RRN)
                remove(TenantPaymentListener.KEY_LAST_AMOUNT)
                remove(TenantPaymentListener.KEY_LAST_APP)
                remove(TenantPaymentListener.KEY_LAST_TIME)
                remove(TenantPaymentListener.KEY_LAST_RAW)
                apply()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_CLEARING_RRN", e.message, e)
        }
    }
}
