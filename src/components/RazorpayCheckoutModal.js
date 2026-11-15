import React, { useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Lock } from "lucide-react-native";
import { responsiveFontSize } from "../theme";

/**
 * RazorpayCheckoutModal — In-app Razorpay checkout driven via official checkout.js
 * inside a secure WebView. Handles card, UPI, netbanking, and wallet flows.
 * Intercepts native UPI app intents (GPay, PhonePe, Paytm, etc.).
 */
export default function RazorpayCheckoutModal({
  visible,
  options,
  onClose,
  onSuccess,
  onFailure,
}) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);

  if (!visible || !options?.key) return null;

  const rzpOptions = {
    key: options.key,
    name: options.name || "Pantro",
    description: options.description || "Pantro Payment",
    image: options.image || "https://ik.imagekit.io/fkhvlkpi1/pantro-icon.png",
    prefill: options.prefill || {},
    theme: { color: options.theme?.color || "#2563eb", backdrop_color: "#07090e" },
    notes: options.notes || {},
  };

  if (options.subscription_id) {
    rzpOptions.subscription_id = options.subscription_id;
  }
  if (options.order_id) {
    rzpOptions.order_id = options.order_id;
  }
  if (options.amount) {
    rzpOptions.amount = options.amount;
  }
  if (options.currency) {
    rzpOptions.currency = options.currency;
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Pantro Secure Checkout</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background-color: #07090e;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
    }
    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
      padding: 24px;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(255, 255, 255, 0.12);
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .title {
      font-size: 16px;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 6px;
    }
    .desc {
      font-size: 13px;
      color: #94a3b8;
      max-width: 280px;
      line-height: 1.5;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(37, 99, 235, 0.15);
      border: 1px solid rgba(37, 99, 235, 0.3);
      color: #60a5fa;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 18px;
    }
  </style>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
  <div class="container" id="loader-view">
    <div class="spinner"></div>
    <div class="title">Connecting to Razorpay...</div>
    <div class="desc">Please do not close or press back while the payment session initializes.</div>
    <div class="badge">🔒 256-Bit SSL Encrypted</div>
  </div>

  <script>
    (function() {
      var config = ${JSON.stringify(rzpOptions)};
      
      config.handler = function(response) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            event: 'SUCCESS',
            data: response
          }));
        }
      };

      config.modal = {
        ondismiss: function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              event: 'DISMISSED'
            }));
          }
        },
        escape: false,
        backdropclose: false
      };

      function launch() {
        try {
          if (typeof Razorpay === 'undefined') {
            setTimeout(launch, 200);
            return;
          }
          var rzp = new Razorpay(config);
          rzp.on('payment.failed', function(resp) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                event: 'FAILED',
                data: resp
              }));
            }
          });
          rzp.open();
        } catch (err) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              event: 'ERROR',
              message: err ? err.message : 'Unknown checkout error'
            }));
          }
        }
      }

      if (document.readyState === 'complete') {
        setTimeout(launch, 300);
      } else {
        window.addEventListener('load', function() {
          setTimeout(launch, 300);
        });
      }
    })();
  </script>
</body>
</html>
  `;

  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.event === "SUCCESS") {
        if (onSuccess) onSuccess(msg.data);
        onClose();
      } else if (msg.event === "DISMISSED") {
        onClose();
      } else if (msg.event === "FAILED") {
        const desc =
          msg.data?.error?.description ||
          msg.data?.error?.reason ||
          "Payment failed. Please try a different payment method.";
        if (onFailure) onFailure(desc);
      } else if (msg.event === "ERROR") {
        if (onFailure) onFailure(msg.message || "Failed to initialize payment gateway.");
      }
    } catch (e) {
      console.warn("[RazorpayModal] Message parsing error:", e);
    }
  };

  const handleShouldStartLoadWithRequest = (request) => {
    const url = request.url || "";
    // If UPI or external wallet deep link, open native app
    if (
      url.startsWith("upi://") ||
      url.startsWith("phonepe://") ||
      url.startsWith("paytmmp://") ||
      url.startsWith("tez://") ||
      url.startsWith("credpay://") ||
      url.startsWith("bhim://")
    ) {
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) {
            Linking.openURL(url);
          } else {
            Linking.openURL(url).catch(() => {});
          }
        })
        .catch(() => {});
      return false;
    }

    // Allow internal checkout URLs
    return true;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            backgroundColor: "#07090e",
          },
        ]}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.lockBadge}>
              <Lock size={12} color="#60a5fa" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Pantro Payments</Text>
              <Text style={styles.headerSubtitle}>Secured by Razorpay</Text>
            </View>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
          >
            <X size={18} color="#cbd5e1" />
          </Pressable>
        </View>

        {/* WebView Container */}
        <View style={styles.webContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent, baseUrl: "https://api.razorpay.com" }}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={false}
            originWhitelist={["*"]}
            mixedContentMode="always"
            allowFileAccess={false}
            bounces={false}
            style={styles.webView}
            onLoadEnd={() => setLoading(false)}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07090e",
  },
  header: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "#0d111a",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lockBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "rgba(37, 99, 235, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: "#f8fafc",
  },
  headerSubtitle: {
    fontSize: responsiveFontSize(11),
    fontWeight: "500",
    color: "#94a3b8",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  webContainer: {
    flex: 1,
    backgroundColor: "#07090e",
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
