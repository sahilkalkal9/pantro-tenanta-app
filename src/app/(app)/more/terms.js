import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ScrollText, CreditCard, Home, AlertCircle, Mail, ArrowLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';
import { Screen, TenantPageHeader, Card } from '../../../components';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../../constants/colors';

const SECTIONS = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    Icon: ScrollText,
    paragraphs: [
      'By logging into the Pantro Tenant Portal and using our mobile or web applications, you agree to comply with and be bound by these Terms of Service.',
      'Pantro acts as the technology platform connecting tenants with their property owners and managers. All underlying tenancy agreements, house rules, and rent arrangements remain between you and your property owner.',
    ],
  },
  {
    id: 'rent',
    title: '2. Rent & Security Deposit Payments',
    Icon: CreditCard,
    paragraphs: [
      'Monthly rent is due on the date specified in your property agreement (typically the 1st or 5th of each month).',
      '• Tenants can make payments directly via UPI, Netbanking, or Cash, and upload proof of payment within the portal.',
      '• Once approved by the manager or owner, an official digital rent receipt is permanently generated in your portal.',
      '• Late payment fees, if applicable, are determined according to your property\'s rules.',
      '• Security deposit refunds upon checkout are processed by your property owner subject to property inspection.',
    ],
  },
  {
    id: 'conduct',
    title: '3. Community Guidelines & House Rules',
    Icon: Home,
    paragraphs: [
      'Residents are expected to maintain peaceful and respectful conduct in the property:',
      '• Adhere to silent hours, visitor policies, and premise security rules defined by the property management.',
      '• Keep common areas, dining zones, and shared rooms clean and damage-free.',
      '• Illegal substances, unauthorized subletting, or hazardous materials are strictly prohibited.',
    ],
  },
  {
    id: 'notice',
    title: '4. Notice Period & Vacating',
    Icon: AlertCircle,
    paragraphs: [
      'When planning to vacate, you must submit a formal digital notice via the Notice Period tab within the portal as per your property\'s agreed notice duration (typically 30 days).',
      'Early departures without meeting the minimum notice period may result in deposit adjustments in accordance with your rental terms.',
    ],
  },
  {
    id: 'contact',
    title: '5. Grievance & Support',
    Icon: Mail,
    paragraphs: [
      'If you have questions about these terms or encounter platform issues, you may raise a ticket in the Support section or contact:',
      'Company: Wabsyte Studio (OPC) Private Limited\nEmail: support@pantro.in',
    ],
  },
];

export default function TenantTermsScreen() {
  const { colors, isDark } = useTheme();

  return (
    <Screen scroll={false}>
      <TenantPageHeader
        title="Terms & Conditions"
        subtitle="Guidelines and rules governing the use of Pantro"
        icon={ScrollText}
        iconTone="blue"
        leftAction={<ArrowLeft size={24} color={colors.textPrimary} onPress={() => router.back()} />}
      />

      <ScrollView
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
                  <Text
                    key={idx}
                    style={[styles.paragraph, { color: colors.textSecondary }]}
                  >
                    {p}
                  </Text>
                ))}
              </View>
            </Card>
          );
        })}

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
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    flex: 1,
  },
  contentBox: {
    gap: SPACING.xs,
  },
  paragraph: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  footerNote: {
    marginTop: SPACING.md,
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  footerText: {
    fontSize: FONT_SIZES.xs,
    textAlign: 'center',
  },
});
