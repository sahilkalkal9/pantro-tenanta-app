import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { Shield, ExternalLink, ArrowLeft, Lock, FileText, CheckCircle2, UserCheck, HelpCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';
import { Screen, TenantPageHeader, Card, Button } from '../../../components';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';
import { responsiveFontSize } from "../../../theme";

const PRIVACY_POLICY_URL = 'https://pantro.in/privacy';

const SECTIONS = [
  {
    id: 'intro',
    title: '1. Introduction & Overview',
    Icon: Shield,
    paragraphs: [
      'Pantro (operated by Wabsyte Studio (OPC) Private Limited) values your trust and is dedicated to protecting your privacy.',
      'This Privacy Policy outlines how we collect, handle, store, and safeguard your personal information when you use the Pantro Tenant Mobile Application and related services.',
    ],
  },
  {
    id: 'collection',
    title: '2. Information We Collect',
    Icon: FileText,
    paragraphs: [
      '• Personal Identification: Full name, phone number, email address, date of birth, and emergency contacts.',
      '• Stay & Tenancy Details: Property name, room number, bed allocation, check-in date, and tenancy tenure.',
      '• Payment Data: Transaction identifiers (UTR / Ref numbers), payment proofs, payment method, and receipts. We do not store sensitive bank account passwords or UPI MPINs.',
      '• KYC Documents: Government identity proofs (Aadhaar, PAN) and digital signatures provided for lease agreements.',
    ],
  },
  {
    id: 'kyc_aadhaar',
    title: '3. Aadhaar & DigiLocker Security',
    Icon: UserCheck,
    paragraphs: [
      '• All Aadhaar verification via DigiLocker complies with UIDAI regulations and official DigiLocker guidelines.',
      '• Pantro does not store your core biometric information or raw Aadhaar credentials on local devices.',
      '• Your Aadhaar number is masked in the UI and accessible only to authorized property verification personnel.',
    ],
  },
  {
    id: 'data_usage',
    title: '4. How We Use Your Data',
    Icon: Lock,
    paragraphs: [
      '• Managing your tenancy, room assignments, and property check-in / check-out processes.',
      '• Processing and recording monthly rent, security deposits, and maintenance charges.',
      '• Facilitating digital rent agreements and generating tamper-proof rent receipts.',
      '• Providing in-app complaint resolution, notice-period tracking, and support ticketing.',
    ],
  },
  {
    id: 'sharing',
    title: '5. Information Sharing',
    Icon: CheckCircle2,
    paragraphs: [
      '• Tenancy Data: Shared solely with your verified property owner and property manager for tenancy administration.',
      '• Third-Party Service Providers: Used only for critical platform functions such as SMS/OTP gateways, cloud hosting, and payment verification.',
      '• No Sale of Data: We never sell, rent, or monetize your personal information to third-party advertisers.',
    ],
  },
  {
    id: 'retention',
    title: '6. Data Security & Your Rights',
    Icon: HelpCircle,
    paragraphs: [
      '• All data in transit is encrypted using industry-standard TLS / HTTPS encryption.',
      '• You retain the right to review your stored personal information, request corrections, or request account data deletion upon vacating the property.',
      '• For any privacy queries or grievance escalation, contact our team at support@pantro.in.',
    ],
  },
];

export default function PrivacyPolicyScreen() {
  const { colors, isDark } = useTheme();

  const openInBrowser = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => {});
  };

  return (
    <Screen scroll={false}>
      <TenantPageHeader
        title="Privacy Policy"
        subtitle="How we protect and manage your personal data"
        icon={Shield}
        iconTone="blue"
        leftAction={<ArrowLeft size={24} color={colors.textPrimary} onPress={() => router.back()} />}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((sec) => {
          const Icon = sec.Icon;
          return (
            <Card key={sec.id} style={styles.sectionCard}>
              <View style={styles.headerRow}>
                <View style={[styles.iconWrapper, { backgroundColor: isDark ? 'rgba(37,99,235,0.18)' : '#eff6ff' }]}>
                  <Icon size={18} color="#2563eb" />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {sec.title}
                </Text>
              </View>

              <View style={styles.contentBox}>
                {sec.paragraphs.map((p, idx) => (
                  <Text key={idx} style={[styles.paragraph, { color: colors.textSecondary }]}>
                    {p}
                  </Text>
                ))}
              </View>
            </Card>
          );
        })}

        <Card style={styles.webActionCard}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.webActionTitle, { color: colors.textPrimary }]}>
              Official Web Policy
            </Text>
            <Text style={[styles.webActionSub, { color: colors.textSecondary }]}>
              View the full legal document on pantro.in
            </Text>
          </View>
          <Button
            title="Open Web Page"
            icon={ExternalLink}
            size="sm"
            variant="outline"
            onPress={openInBrowser}
          />
        </Card>

        <View style={styles.footerNote}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            © {new Date().getFullYear()} Pantro. A Product of Wabsyte Studio (OPC) Private Limited.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  sectionCard: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: responsiveFontSize(FONT_SIZES.md),
    fontWeight: FONT_WEIGHTS.bold,
    flex: 1,
  },
  contentBox: {
    gap: SPACING.xs,
  },
  paragraph: {
    fontSize: responsiveFontSize(FONT_SIZES.sm),
    lineHeight: 20,
  },
  webActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  webActionTitle: {
    fontSize: responsiveFontSize(FONT_SIZES.sm),
    fontWeight: '700',
  },
  webActionSub: {
    fontSize: responsiveFontSize(11),
    marginTop: 2,
  },
  footerNote: {
    marginTop: SPACING.xs,
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  footerText: {
    fontSize: responsiveFontSize(FONT_SIZES.xs),
    textAlign: 'center',
  },
});
