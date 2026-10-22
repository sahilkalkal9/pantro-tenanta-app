import React from 'react';
import { View, Text, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Shield, ExternalLink, ArrowLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';
import {
  Screen, TenantPageHeader, Card, Button,
} from '../../../components';
import { COLORS, SPACING, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

const PRIVACY_POLICY_URL = 'https://pantro.in/privacy';

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const handleLoad = () => setLoading(false);
  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  const openInBrowser = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
      // fallback handled by error state
    });
  };

  return (
    <Screen>
      <TenantPageHeader
        title="Privacy Policy"
        subtitle="How we protect your data"
        icon={Shield}
        iconTone="blue"
        leftAction={<ArrowLeft size={24} color={colors.textPrimary} onPress={() => router.back()} />}
      />

      <Card style={styles.card}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading privacy policy…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <ExternalLink size={48} color={colors.danger} />
            <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Unable to Load</Text>
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>
              Could not load the privacy policy page. Please try opening it in your browser.
            </Text>
            <Button
              title="Open in Browser"
              icon={ExternalLink}
              onPress={openInBrowser}
              fullWidth
              style={{ marginTop: SPACING.md }}
            />
          </View>
        ) : (
          <WebView
            source={{ uri: PRIVACY_POLICY_URL }}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mixedContentMode="always"
            onLoad={handleLoad}
            onError={handleError}
            onLoadEnd={handleLoad}
          />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZES.md },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, marginTop: SPACING.md },
  errorText: {
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginHorizontal: SPACING.md,
  },
  webView: { flex: 1 },
});